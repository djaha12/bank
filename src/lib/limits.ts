import { Currency } from "@prisma/client";
import { startOfDay, startOfMonth } from "date-fns";
import type { Tx } from "@/lib/db";

/**
 * Per-customer transfer limits (sandbox defaults). In production these come
 * from product config / risk tier, not constants.
 */
export const TRANSFER_LIMITS = {
  perTransaction: {
    KGS: 5_000_000_00n, // 5,000,000.00 KGS
    USD: 50_000_00n,
    EUR: 50_000_00n,
  } as Record<Currency, bigint>,
  daily: {
    KGS: 10_000_000_00n,
    USD: 100_000_00n,
    EUR: 100_000_00n,
  } as Record<Currency, bigint>,
};

export interface LimitCheck {
  ok: boolean;
  reason?: string;
}

/** Sum of a user's outgoing transfer amounts since `since`, by currency. */
async function outgoingSince(
  tx: Tx,
  userId: string,
  currency: Currency,
  since: Date,
): Promise<bigint> {
  const rows = await tx.transfer.findMany({
    where: { userId, currency, createdAt: { gte: since } },
    select: { amount: true },
  });
  return rows.reduce((sum, r) => sum + r.amount, 0n);
}

export async function checkTransferLimits(
  tx: Tx,
  userId: string,
  currency: Currency,
  amount: bigint,
): Promise<LimitCheck> {
  const perTx = TRANSFER_LIMITS.perTransaction[currency];
  if (amount > perTx) {
    return { ok: false, reason: `Exceeds per-transaction limit (${perTx} minor units)` };
  }
  const dailyLimit = TRANSFER_LIMITS.daily[currency];
  const usedToday = await outgoingSince(tx, userId, currency, startOfDay(new Date()));
  if (usedToday + amount > dailyLimit) {
    return { ok: false, reason: `Exceeds daily transfer limit (${dailyLimit} minor units)` };
  }
  return { ok: true };
}

/** Card spend used today / this month for limit enforcement. */
export async function cardSpend(tx: Tx, cardId: string) {
  const today = await tx.hold.findMany({
    where: { cardId, createdAt: { gte: startOfDay(new Date()) } },
    select: { amount: true },
  });
  const month = await tx.hold.findMany({
    where: { cardId, createdAt: { gte: startOfMonth(new Date()) } },
    select: { amount: true },
  });
  return {
    daily: today.reduce((s, h) => s + h.amount, 0n),
    monthly: month.reduce((s, h) => s + h.amount, 0n),
  };
}
