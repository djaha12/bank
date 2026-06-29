import { Currency, TransactionType } from "@prisma/client";
import type { Tx } from "@/lib/db";
import { applyBps } from "@/lib/money";

export interface FeeComputation {
  amount: bigint; // fee in minor units
  ruleKey: string | null;
  bps: number;
  flat: bigint;
}

/**
 * Fee = flatAmount + (amount * bps / 10000), floored. Returns zero fee when no
 * active rule matches. Fees are a first-class ledger movement (credited to the
 * FEE_INCOME system account) — never silently subtracted from a balance.
 */
export async function computeFee(
  tx: Tx,
  key: string,
  amount: bigint,
  _currency: Currency,
): Promise<FeeComputation> {
  const rule = await tx.feeRule.findFirst({ where: { key, active: true } });
  if (!rule) return { amount: 0n, ruleKey: null, bps: 0, flat: 0n };
  const fee = rule.flatAmount + applyBps(amount, rule.bps);
  return { amount: fee < 0n ? 0n : fee, ruleKey: rule.key, bps: rule.bps, flat: rule.flatAmount };
}

export function feeKeyFor(type: TransactionType, kind?: string): string {
  switch (type) {
    case "FX_CONVERSION":
      return "fx.spread";
    case "P2P_TRANSFER":
      return "transfer.p2p";
    case "INTERNAL_TRANSFER":
      return kind === "BANK" ? "transfer.bank" : "transfer.internal";
    case "CARD_AUTHORIZATION":
    case "CARD_CAPTURE":
      return "card.purchase";
    default:
      return `${type.toLowerCase()}.fee`;
  }
}
