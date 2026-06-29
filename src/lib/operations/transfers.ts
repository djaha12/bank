import {
  AccountStatus,
  Currency,
  LedgerDirection,
  TransactionStatus,
  TransactionType,
  TransferKind,
  UserStatus,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { AppError, Errors } from "@/lib/errors";
import { postTransaction, type PostingLeg } from "@/lib/ledger";
import { computeFee, feeKeyFor } from "@/lib/fees";
import { checkTransferLimits } from "@/lib/limits";
import { getSystemAccount } from "@/lib/system-accounts";
import { applyRiskOutcome, evaluateTransactionRisk } from "@/lib/risk-engine";
import { writeAudit } from "@/lib/audit";
import { notify } from "@/lib/notifications";
import { formatMoney } from "@/lib/money";

export interface TransferInput {
  userId: string;
  kind: TransferKind;
  fromAccountId: string;
  toAccountId?: string | null;
  counterparty?: Record<string, unknown> | null;
  amount: bigint;
  note?: string | null;
  newDevice?: boolean;
  ip?: string | null;
  userAgent?: string | null;
}

export interface TransferResult {
  transferId: string;
  transactionId: string;
  status: TransactionStatus;
  fromBalanceAfter: bigint;
  toBalanceAfter: bigint | null;
  fee: bigint;
  currency: Currency;
  alerts: number;
}

function txTypeFor(kind: TransferKind): TransactionType {
  return kind === TransferKind.P2P
    ? TransactionType.P2P_TRANSFER
    : TransactionType.INTERNAL_TRANSFER;
}

/**
 * Execute a money transfer on the double-entry ledger. Handles OWN / P2P /
 * BANK / QR kinds. All checks (ownership, status, available balance, limits,
 * risk) run inside the same serializable DB transaction as the posting.
 */
export async function executeTransfer(input: TransferInput): Promise<TransferResult> {
  if (input.amount <= 0n) throw Errors.validation("Amount must be positive");

  try {
    return await prisma.$transaction(
    async (tx) => {
      const [user, fromAccount] = await Promise.all([
        tx.user.findUnique({ where: { id: input.userId } }),
        tx.account.findUnique({ where: { id: input.fromAccountId } }),
      ]);

      if (!user) throw Errors.notFound("User not found");
      if (user.status !== UserStatus.ACTIVE) {
        throw Errors.blocked(`Account status is ${user.status}`);
      }
      if (!fromAccount || fromAccount.deletedAt) throw Errors.notFound("Source account not found");
      if (fromAccount.userId !== input.userId) throw Errors.forbidden("Not your account");
      if (fromAccount.status !== AccountStatus.ACTIVE) {
        throw Errors.blocked(`Source account is ${fromAccount.status}`);
      }

      const currency = fromAccount.currency;

      // Resolve destination (internal account) when applicable.
      let toAccount = null;
      if (input.toAccountId) {
        toAccount = await tx.account.findUnique({ where: { id: input.toAccountId } });
        if (!toAccount || toAccount.deletedAt) throw Errors.notFound("Destination account not found");
        if (toAccount.currency !== currency) {
          throw Errors.validation("Cross-currency transfers must use FX conversion");
        }
        if (toAccount.status !== AccountStatus.ACTIVE) {
          throw Errors.blocked("Destination account is not active");
        }
        if (input.kind === TransferKind.OWN && toAccount.userId !== input.userId) {
          throw Errors.forbidden("OWN transfer requires your own destination account");
        }
        if (toAccount.id === fromAccount.id) {
          throw Errors.validation("Cannot transfer to the same account");
        }
      } else if (input.kind !== TransferKind.BANK) {
        throw Errors.validation("Destination account required for this transfer kind");
      }

      // Fee.
      const fee = await computeFee(tx, feeKeyFor(txTypeFor(input.kind), input.kind), input.amount, currency);
      const totalDebit = input.amount + fee.amount;

      // Available balance = cached balance - active holds.
      const available = fromAccount.balanceCached - fromAccount.holdTotal;
      if (available < totalDebit) {
        // Decline (recorded as a FAILED txn AFTER this tx rolls back — see catch).
        throw Errors.insufficientFunds(
          `Need ${formatMoney(totalDebit, currency)}, available ${formatMoney(available, currency)}`,
        );
      }

      // Limits.
      const limit = await checkTransferLimits(tx, input.userId, currency, input.amount);
      if (!limit.ok) {
        throw Errors.limitExceeded(limit.reason);
      }

      // Build posting legs.
      const legs: PostingLeg[] = [
        { accountId: fromAccount.id, direction: LedgerDirection.DEBIT, amount: input.amount, currency },
      ];
      if (toAccount) {
        legs.push({
          accountId: toAccount.id,
          direction: LedgerDirection.CREDIT,
          amount: input.amount,
          currency,
        });
      } else {
        // External/bank sandbox: settle to the SETTLEMENT system account.
        const settlement = await getSystemAccount(tx, "SETTLEMENT", currency);
        legs.push({
          accountId: settlement,
          direction: LedgerDirection.CREDIT,
          amount: input.amount,
          currency,
        });
      }
      if (fee.amount > 0n) {
        const feeIncome = await getSystemAccount(tx, "FEE_INCOME", currency);
        legs.push({ accountId: fromAccount.id, direction: LedgerDirection.DEBIT, amount: fee.amount, currency });
        legs.push({ accountId: feeIncome, direction: LedgerDirection.CREDIT, amount: fee.amount, currency });
      }

      const reference = `TRF-${Date.now().toString(36).toUpperCase()}`;
      const transaction = await postTransaction(tx, {
        type: txTypeFor(input.kind),
        currency,
        amount: input.amount,
        feeAmount: fee.amount,
        description: input.note ?? `${input.kind} transfer`,
        reference,
        userId: input.userId,
        legs,
        metadata: { kind: input.kind, feeRule: fee.ruleKey },
      });

      const transfer = await tx.transfer.create({
        data: {
          transactionId: transaction.id,
          userId: input.userId,
          kind: input.kind,
          fromAccountId: fromAccount.id,
          toAccountId: toAccount?.id ?? null,
          counterparty: (input.counterparty ?? undefined) as
            | import("@prisma/client").Prisma.InputJsonValue
            | undefined,
          amount: input.amount,
          currency,
          note: input.note ?? undefined,
        },
      });

      // Risk evaluation (advisory alerts; does not block here).
      const counterpartyCountry =
        typeof input.counterparty?.country === "string" ? (input.counterparty.country as string) : null;
      const hits = await evaluateTransactionRisk(tx, {
        userId: input.userId,
        amount: input.amount,
        currency,
        type: txTypeFor(input.kind),
        newDevice: input.newDevice,
        counterpartyCountry,
      });
      const risk = await applyRiskOutcome(tx, input.userId, hits, transaction.id);

      await writeAudit(
        {
          actorType: "USER",
          actorId: input.userId,
          action: "transfer.create",
          entity: "Transfer",
          entityId: transfer.id,
          after: { amount: input.amount.toString(), currency, kind: input.kind, reference },
          ipAddress: input.ip,
          userAgent: input.userAgent,
        },
        tx,
      );

      await notify(
        {
          userId: input.userId,
          type: "TRANSACTION",
          title: "Transfer sent",
          body: `${formatMoney(input.amount, currency, { withCode: true })} via ${input.kind} transfer.`,
          metadata: { transactionId: transaction.id },
        },
        tx,
      );

      const refreshedFrom = await tx.account.findUnique({
        where: { id: fromAccount.id },
        select: { balanceCached: true },
      });
      const refreshedTo = toAccount
        ? await tx.account.findUnique({ where: { id: toAccount.id }, select: { balanceCached: true } })
        : null;

      return {
        transferId: transfer.id,
        transactionId: transaction.id,
        status: transaction.status,
        fromBalanceAfter: refreshedFrom?.balanceCached ?? 0n,
        toBalanceAfter: refreshedTo?.balanceCached ?? null,
        fee: fee.amount,
        currency,
        alerts: risk.alerts,
      } satisfies TransferResult;
      },
      { isolationLevel: "Serializable", timeout: 15000 },
    );
  } catch (err) {
    // Business declines are recorded as a FAILED transaction in a SEPARATE
    // (committed) transaction, since the main tx above rolled back.
    if (
      err instanceof AppError &&
      (err.code === "INSUFFICIENT_FUNDS" || err.code === "LIMIT_EXCEEDED")
    ) {
      await recordFailedTransfer(input, err.code).catch(() => undefined);
    }
    throw err;
  }
}

/** Record a declined transfer as a FAILED transaction (no ledger entries). */
async function recordFailedTransfer(input: TransferInput, reason: string) {
  const from = await prisma.account.findUnique({
    where: { id: input.fromAccountId },
    select: { currency: true },
  });
  if (!from) return;
  const failed = await prisma.transaction.create({
    data: {
      type: txTypeFor(input.kind),
      status: TransactionStatus.FAILED,
      currency: from.currency,
      amount: input.amount,
      description: `Declined: ${reason}`,
      userId: input.userId,
      metadata: { kind: input.kind, declineReason: reason },
    },
  });
  await notify({
    userId: input.userId,
    type: "TRANSACTION",
    title: "Transfer declined",
    body: `${formatMoney(input.amount, from.currency)} transfer was declined (${reason}).`,
    metadata: { transactionId: failed.id, reason },
  });
}

// Re-export AppError for callers that catch domain failures.
export { AppError };
