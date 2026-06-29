import {
  AccountStatus,
  CardStatus,
  HoldStatus,
  LedgerDirection,
  TransactionStatus,
  TransactionType,
  UserStatus,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { Errors } from "@/lib/errors";
import { postTransaction, type PostingLeg } from "@/lib/ledger";
import { computeFee } from "@/lib/fees";
import { cardSpend } from "@/lib/limits";
import { getSystemAccount } from "@/lib/system-accounts";
import { applyRiskOutcome, evaluateTransactionRisk } from "@/lib/risk-engine";
import { writeAudit } from "@/lib/audit";
import { notify } from "@/lib/notifications";
import { formatMoney } from "@/lib/money";

export interface CardPurchaseInput {
  userId: string;
  cardId: string;
  amount: bigint; // minor units, card account currency
  merchantName: string;
  mcc: string;
  /** When true (default) the purchase auth is captured/settled immediately. */
  capture?: boolean;
  newDevice?: boolean;
  ip?: string | null;
  userAgent?: string | null;
}

/**
 * Simulate a card purchase authorization. Validates card state + controls +
 * limits + available funds, then either places a hold (authorization) or
 * settles immediately (capture). No real card network, no real PAN.
 */
export async function simulateCardPurchase(input: CardPurchaseInput) {
  if (input.amount <= 0n) throw Errors.validation("Amount must be positive");
  const capture = input.capture ?? true;

  return prisma.$transaction(
    async (tx) => {
      const card = await tx.card.findUnique({
        where: { id: input.cardId },
        include: { account: true, limit: true, merchantControls: true },
      });
      if (!card || card.deletedAt) throw Errors.notFound("Card not found");
      if (card.userId !== input.userId) throw Errors.forbidden("Not your card");

      const user = await tx.user.findUnique({ where: { id: input.userId } });
      if (!user || user.status !== UserStatus.ACTIVE) throw Errors.blocked();
      if (card.status !== CardStatus.ACTIVE) throw Errors.blocked(`Card is ${card.status}`);
      if (!card.onlinePaymentsEnabled) throw Errors.blocked("Online payments are disabled for this card");
      if (card.account.status !== AccountStatus.ACTIVE) throw Errors.blocked("Linked account is not active");

      const blocked = card.merchantControls.find((m) => m.mcc === input.mcc && m.blocked);
      if (blocked) throw Errors.blocked(`Merchant category ${input.mcc} is blocked for this card`);

      const currency = card.account.currency;
      const fee = await computeFee(tx, "card.purchase", input.amount, currency);

      // Card limits.
      if (card.limit) {
        if (card.limit.perTxLimit > 0n && input.amount > card.limit.perTxLimit) {
          throw Errors.limitExceeded("Exceeds per-transaction card limit");
        }
        const spend = await cardSpend(tx, card.id);
        if (card.limit.dailyLimit > 0n && spend.daily + input.amount > card.limit.dailyLimit) {
          throw Errors.limitExceeded("Exceeds daily card limit");
        }
        if (card.limit.monthlyLimit > 0n && spend.monthly + input.amount > card.limit.monthlyLimit) {
          throw Errors.limitExceeded("Exceeds monthly card limit");
        }
      }

      const available = card.account.balanceCached - card.account.holdTotal;
      const totalNeeded = input.amount + fee.amount;
      if (available < totalNeeded) {
        throw Errors.insufficientFunds(
          `Need ${formatMoney(totalNeeded, currency)}, available ${formatMoney(available, currency)}`,
        );
      }

      const reference = `CARD-${Date.now().toString(36).toUpperCase()}`;
      let transactionId: string;
      let status: TransactionStatus;
      let holdStatus: HoldStatus;

      if (capture) {
        const cardScheme = await getSystemAccount(tx, "CARD_SCHEME", currency);
        const legs: PostingLeg[] = [
          { accountId: card.accountId, direction: LedgerDirection.DEBIT, amount: input.amount, currency },
          { accountId: cardScheme, direction: LedgerDirection.CREDIT, amount: input.amount, currency },
        ];
        if (fee.amount > 0n) {
          const feeIncome = await getSystemAccount(tx, "FEE_INCOME", currency);
          legs.push({ accountId: card.accountId, direction: LedgerDirection.DEBIT, amount: fee.amount, currency });
          legs.push({ accountId: feeIncome, direction: LedgerDirection.CREDIT, amount: fee.amount, currency });
        }
        const transaction = await postTransaction(tx, {
          type: TransactionType.CARD_CAPTURE,
          currency,
          amount: input.amount,
          feeAmount: fee.amount,
          description: input.merchantName,
          reference,
          userId: input.userId,
          legs,
          metadata: { mcc: input.mcc, merchant: input.merchantName, cardId: card.id },
        });
        transactionId = transaction.id;
        status = TransactionStatus.COMPLETED;
        holdStatus = HoldStatus.CAPTURED;
        await tx.hold.create({
          data: {
            accountId: card.accountId,
            cardId: card.id,
            transactionId,
            amount: input.amount,
            currency,
            status: holdStatus,
            merchantName: input.merchantName,
            mcc: input.mcc,
            releasedAt: new Date(),
          },
        });
      } else {
        // Authorization only: place a hold, no ledger movement yet.
        const transaction = await tx.transaction.create({
          data: {
            type: TransactionType.CARD_AUTHORIZATION,
            status: TransactionStatus.PENDING,
            currency,
            amount: input.amount,
            feeAmount: fee.amount,
            description: input.merchantName,
            reference,
            userId: input.userId,
            metadata: { mcc: input.mcc, merchant: input.merchantName, cardId: card.id, hold: true },
          },
        });
        transactionId = transaction.id;
        status = TransactionStatus.PENDING;
        holdStatus = HoldStatus.HELD;
        await tx.hold.create({
          data: {
            accountId: card.accountId,
            cardId: card.id,
            transactionId,
            amount: input.amount,
            currency,
            status: holdStatus,
            merchantName: input.merchantName,
            mcc: input.mcc,
            expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
          },
        });
        await tx.account.update({
          where: { id: card.accountId },
          data: { holdTotal: card.account.holdTotal + input.amount },
        });
      }

      // Budget tracking (best-effort): increment matching category budget spend.
      await tx.budget.updateMany({
        where: { userId: input.userId, currency, category: { mccPrefixes: { has: input.mcc } } },
        data: { spentCached: { increment: input.amount } },
      });

      const hits = await evaluateTransactionRisk(tx, {
        userId: input.userId,
        amount: input.amount,
        currency,
        type: capture ? TransactionType.CARD_CAPTURE : TransactionType.CARD_AUTHORIZATION,
        newDevice: input.newDevice,
        mcc: input.mcc,
      });
      await applyRiskOutcome(tx, input.userId, hits, transactionId);

      await writeAudit(
        {
          actorType: "USER",
          actorId: input.userId,
          action: capture ? "card.capture" : "card.authorize",
          entity: "Card",
          entityId: card.id,
          after: { amount: input.amount.toString(), merchant: input.merchantName, mcc: input.mcc },
          ipAddress: input.ip,
          userAgent: input.userAgent,
        },
        tx,
      );

      await notify(
        {
          userId: input.userId,
          type: "CARD",
          title: capture ? "Card payment" : "Card authorization",
          body: `${formatMoney(input.amount, currency)} at ${input.merchantName}`,
          metadata: { transactionId, mcc: input.mcc },
        },
        tx,
      );

      const account = await tx.account.findUnique({
        where: { id: card.accountId },
        select: { balanceCached: true, holdTotal: true },
      });

      return {
        transactionId,
        reference,
        status,
        holdStatus,
        amount: input.amount,
        fee: fee.amount,
        currency,
        balanceAfter: account?.balanceCached ?? 0n,
        availableAfter: (account?.balanceCached ?? 0n) - (account?.holdTotal ?? 0n),
      };
    },
    { isolationLevel: "Serializable", timeout: 15000 },
  );
}
