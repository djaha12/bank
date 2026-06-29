import {
  AuditActorType,
  HoldStatus,
  LedgerDirection,
  TransactionStatus,
  TransactionType,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { Errors } from "@/lib/errors";
import { postTransaction } from "@/lib/ledger";
import { getSystemAccount } from "@/lib/system-accounts";
import { writeAudit } from "@/lib/audit";
import { notify } from "@/lib/notifications";
import { formatMoney } from "@/lib/money";

/**
 * Capture a previously-authorized hold: settles the earmarked funds onto the
 * ledger (debit the card account, credit the CARD_SCHEME system account),
 * releases the hold earmark, and marks the authorization COMPLETED. This is the
 * second leg of two-phase card processing (auth → capture).
 */
export async function captureHold(args: {
  holdId: string;
  actorType?: AuditActorType;
  actorId?: string | null;
}) {
  return prisma.$transaction(
    async (tx) => {
      const hold = await tx.hold.findUnique({ where: { id: args.holdId }, include: { account: true } });
      if (!hold) throw Errors.notFound("Hold not found");
      if (hold.status !== HoldStatus.HELD) throw Errors.conflict(`Hold is ${hold.status}, not capturable`);

      const currency = hold.currency;
      const cardScheme = await getSystemAccount(tx, "CARD_SCHEME", currency);

      const capture = await postTransaction(tx, {
        type: TransactionType.CARD_CAPTURE,
        currency,
        amount: hold.amount,
        description: hold.merchantName ?? "Card capture",
        reference: `CAP-${Date.now().toString(36).toUpperCase()}`,
        userId: hold.account.userId,
        relatedTransactionId: hold.transactionId,
        legs: [
          { accountId: hold.accountId, direction: LedgerDirection.DEBIT, amount: hold.amount, currency },
          { accountId: cardScheme, direction: LedgerDirection.CREDIT, amount: hold.amount, currency },
        ],
        metadata: { mcc: hold.mcc, merchant: hold.merchantName, holdId: hold.id },
      });

      // The earmark is now realized as a real debit — release the hold reserve.
      await tx.account.update({
        where: { id: hold.accountId },
        data: { holdTotal: { decrement: hold.amount } },
      });
      await tx.hold.update({
        where: { id: hold.id },
        data: { status: HoldStatus.CAPTURED, releasedAt: new Date() },
      });
      if (hold.transactionId) {
        await tx.transaction.update({
          where: { id: hold.transactionId },
          data: { status: TransactionStatus.COMPLETED, postedAt: new Date() },
        });
      }

      await writeAudit(
        {
          actorType: args.actorType ?? "USER",
          actorId: args.actorId ?? hold.account.userId,
          action: "hold.capture",
          entity: "Hold",
          entityId: hold.id,
          after: { amount: hold.amount.toString(), captureTransactionId: capture.id },
        },
        tx,
      );
      if (hold.account.userId) {
        await notify(
          {
            userId: hold.account.userId,
            type: "CARD",
            title: "Authorization captured",
            body: `${formatMoney(hold.amount, currency)} at ${hold.merchantName ?? "merchant"} was captured.`,
            metadata: { holdId: hold.id },
          },
          tx,
        );
      }
      return { holdId: hold.id, captureTransactionId: capture.id };
    },
    { isolationLevel: "Serializable", timeout: 15000 },
  );
}

/**
 * Release (void) an authorization without capturing: frees the earmarked funds
 * and marks the authorization FAILED. No ledger movement (money never left).
 */
export async function releaseHold(args: {
  holdId: string;
  reason?: string;
  actorType?: AuditActorType;
  actorId?: string | null;
}) {
  return prisma.$transaction(
    async (tx) => {
      const hold = await tx.hold.findUnique({ where: { id: args.holdId }, include: { account: true } });
      if (!hold) throw Errors.notFound("Hold not found");
      if (hold.status !== HoldStatus.HELD) throw Errors.conflict(`Hold is ${hold.status}, not releasable`);

      await tx.account.update({
        where: { id: hold.accountId },
        data: { holdTotal: { decrement: hold.amount } },
      });
      await tx.hold.update({
        where: { id: hold.id },
        data: { status: HoldStatus.RELEASED, releasedAt: new Date() },
      });
      if (hold.transactionId) {
        await tx.transaction.update({
          where: { id: hold.transactionId },
          data: {
            status: TransactionStatus.FAILED,
            description: `Authorization released${args.reason ? `: ${args.reason}` : ""}`,
          },
        });
      }

      await writeAudit(
        {
          actorType: args.actorType ?? "USER",
          actorId: args.actorId ?? hold.account.userId,
          action: "hold.release",
          entity: "Hold",
          entityId: hold.id,
          after: { amount: hold.amount.toString(), reason: args.reason ?? null },
        },
        tx,
      );
      if (hold.account.userId) {
        await notify(
          {
            userId: hold.account.userId,
            type: "CARD",
            title: "Authorization released",
            body: `${formatMoney(hold.amount, hold.currency)} hold at ${hold.merchantName ?? "merchant"} was released.`,
            metadata: { holdId: hold.id },
          },
          tx,
        );
      }
      return { holdId: hold.id };
    },
    { isolationLevel: "Serializable", timeout: 15000 },
  );
}

/** Sweep expired authorizations and release them (cron/admin job). */
export async function expireHolds() {
  const expired = await prisma.hold.findMany({
    where: { status: HoldStatus.HELD, expiresAt: { lt: new Date() } },
    select: { id: true },
  });
  let released = 0;
  for (const h of expired) {
    await releaseHold({ holdId: h.id, reason: "expired", actorType: "SYSTEM", actorId: null })
      .then(() => (released += 1))
      .catch(() => undefined);
  }
  return { released };
}
