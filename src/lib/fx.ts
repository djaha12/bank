import { Currency } from "@prisma/client";
import type { Tx } from "@/lib/db";
import { LedgerError } from "@/lib/ledger";

export interface FxQuote {
  base: Currency;
  quote: Currency;
  rateScaled: bigint; // mid-market rate * scale
  scale: bigint;
  spreadBps: number;
  /** Output minor units the customer receives for `inputAmount` of base. */
  outputAmount: bigint;
  inputAmount: bigint;
  /** Effective rate after spread, * scale (for display/audit). */
  effectiveRateScaled: bigint;
}

/**
 * Convert `inputAmount` (minor units of `base`) into `quote` minor units using
 * the latest sandbox FxRate. The spread is applied AGAINST the customer (they
 * receive slightly less quote currency). All integer math — no floats.
 *
 * NOTE: assumes both currencies share the same minor-unit scale (all of
 * KGS/USD/EUR use 2 decimals here). If you add a 0- or 3-decimal currency,
 * adjust for the decimal delta.
 */
export async function quoteFx(
  tx: Tx,
  base: Currency,
  quote: Currency,
  inputAmount: bigint,
): Promise<FxQuote> {
  if (base === quote) {
    throw new LedgerError("FX base and quote must differ", "FX_SAME_CURRENCY");
  }
  if (inputAmount <= 0n) {
    throw new LedgerError("FX amount must be positive", "FX_NON_POSITIVE");
  }

  const rate = await tx.fxRate.findFirst({
    where: { baseCurrency: base, quoteCurrency: quote },
    orderBy: { asOf: "desc" },
  });
  if (!rate) {
    throw new LedgerError(`No FX rate for ${base}->${quote}`, "FX_RATE_MISSING");
  }

  const scale = BigInt(rate.scale);
  const spreadBps = BigInt(rate.spreadBps);
  // effective = mid * (10000 - spread) / 10000
  const effectiveRateScaled = (rate.rateScaled * (10000n - spreadBps)) / 10000n;
  const outputAmount = (inputAmount * effectiveRateScaled) / scale;

  return {
    base,
    quote,
    rateScaled: rate.rateScaled,
    scale,
    spreadBps: rate.spreadBps,
    outputAmount,
    inputAmount,
    effectiveRateScaled,
  };
}
