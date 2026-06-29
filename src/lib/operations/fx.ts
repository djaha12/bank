import {
  AccountStatus,
  Currency,
  LedgerDirection,
  TransactionType,
  UserStatus,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { Errors } from "@/lib/errors";
import { postTransaction, type PostingLeg } from "@/lib/ledger";
import { computeFee } from "@/lib/fees";
import { quoteFx } from "@/lib/fx";
import { getSystemAccount } from "@/lib/system-accounts";
import { applyRiskOutcome, evaluateTransactionRisk } from "@/lib/risk-engine";
import { writeAudit } from "@/lib/audit";
import { notify } from "@/lib/notifications";
import { formatMoney } from "@/lib/money";

export interface FxInput {
  userId: string;
  fromAccountId: string; // base currency account (debited)
  toAccountId: string; // quote currency account (credited)
  amount: bigint; // base minor units
  newDevice?: boolean;
  ip?: string | null;
  userAgent?: string | null;
}

export async function executeFxConversion(input: FxInput) {
  if (input.amount <= 0n) throw Errors.validation("Amount must be positive");

  return prisma.$transaction(
    async (tx) => {
      const [user, from, to] = await Promise.all([
        tx.user.findUnique({ where: { id: input.userId } }),
        tx.account.findUnique({ where: { id: input.fromAccountId } }),
        tx.account.findUnique({ where: { id: input.toAccountId } }),
      ]);

      if (!user || user.status !== UserStatus.ACTIVE) throw Errors.blocked();
      if (!from || from.deletedAt || from.userId !== input.userId) throw Errors.forbidden("Invalid source account");
      if (!to || to.deletedAt || to.userId !== input.userId) throw Errors.forbidden("Invalid destination account");
      if (from.status !== AccountStatus.ACTIVE || to.status !== AccountStatus.ACTIVE) throw Errors.blocked();
      if (from.currency === to.currency) throw Errors.validation("Accounts must have different currencies");

      const base: Currency = from.currency;
      const quote: Currency = to.currency;

      const fx = await quoteFx(tx, base, quote, input.amount);
      const fee = await computeFee(tx, "fx.spread", input.amount, base);
      const totalDebit = input.amount + fee.amount;

      const available = from.balanceCached - from.holdTotal;
      if (available < totalDebit) {
        throw Errors.insufficientFunds(
          `Need ${formatMoney(totalDebit, base)}, available ${formatMoney(available, base)}`,
        );
      }

      const fxPosBase = await getSystemAccount(tx, "FX_POSITION", base);
      const fxPosQuote = await getSystemAccount(tx, "FX_POSITION", quote);

      const legs: PostingLeg[] = [
        // Base side: customer sells base; FX position absorbs it.
        { accountId: from.id, direction: LedgerDirection.DEBIT, amount: input.amount, currency: base },
        { accountId: fxPosBase, direction: LedgerDirection.CREDIT, amount: input.amount, currency: base },
        // Quote side: FX position supplies quote; customer receives it.
        { accountId: fxPosQuote, direction: LedgerDirection.DEBIT, amount: fx.outputAmount, currency: quote },
        { accountId: to.id, direction: LedgerDirection.CREDIT, amount: fx.outputAmount, currency: quote },
      ];
      if (fee.amount > 0n) {
        const feeIncome = await getSystemAccount(tx, "FEE_INCOME", base);
        legs.push({ accountId: from.id, direction: LedgerDirection.DEBIT, amount: fee.amount, currency: base });
        legs.push({ accountId: feeIncome, direction: LedgerDirection.CREDIT, amount: fee.amount, currency: base });
      }

      const reference = `FX-${Date.now().toString(36).toUpperCase()}`;
      const transaction = await postTransaction(tx, {
        type: TransactionType.FX_CONVERSION,
        currency: base,
        amount: input.amount,
        feeAmount: fee.amount,
        description: `Convert ${base} → ${quote}`,
        reference,
        userId: input.userId,
        legs,
        metadata: {
          quoteCurrency: quote,
          outputAmount: fx.outputAmount.toString(),
          rateScaled: fx.rateScaled.toString(),
          effectiveRateScaled: fx.effectiveRateScaled.toString(),
          scale: fx.scale.toString(),
          spreadBps: fx.spreadBps,
        },
      });

      const hits = await evaluateTransactionRisk(tx, {
        userId: input.userId,
        amount: input.amount,
        currency: base,
        type: TransactionType.FX_CONVERSION,
        newDevice: input.newDevice,
      });
      await applyRiskOutcome(tx, input.userId, hits, transaction.id);

      await writeAudit(
        {
          actorType: "USER",
          actorId: input.userId,
          action: "fx.convert",
          entity: "Transaction",
          entityId: transaction.id,
          after: {
            base,
            quote,
            input: input.amount.toString(),
            output: fx.outputAmount.toString(),
          },
          ipAddress: input.ip,
          userAgent: input.userAgent,
        },
        tx,
      );

      await notify(
        {
          userId: input.userId,
          type: "TRANSACTION",
          title: "Currency exchanged",
          body: `${formatMoney(input.amount, base)} → ${formatMoney(fx.outputAmount, quote)}`,
          metadata: { transactionId: transaction.id },
        },
        tx,
      );

      return {
        transactionId: transaction.id,
        reference,
        base,
        quote,
        inputAmount: input.amount,
        outputAmount: fx.outputAmount,
        fee: fee.amount,
        rateScaled: fx.rateScaled,
        effectiveRateScaled: fx.effectiveRateScaled,
        scale: fx.scale,
        spreadBps: fx.spreadBps,
      };
    },
    { isolationLevel: "Serializable", timeout: 15000 },
  );
}
