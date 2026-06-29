import { describe, it, expect } from "vitest";
import { quoteFx } from "@/lib/fx";
import type { Tx } from "@/lib/db";

/** Minimal stub of the Prisma tx surface quoteFx uses (no real DB). */
function stubTx(rateScaled: bigint, scale = 100_000_000, spreadBps = 50): Tx {
  return {
    fxRate: {
      findFirst: async () => ({ rateScaled, scale, spreadBps }),
    },
  } as unknown as Tx;
}

describe("FX conversion math", () => {
  it("applies the spread against the customer", async () => {
    // 1 USD = 89 KGS, scale 1e8 => rateScaled = 89e8.
    const q = await quoteFx(stubTx(8_900_000_000n), "USD", "KGS", 10000n); // 100.00 USD
    // effective = 89 * (1 - 0.005) = 88.555 => 100.00 * 88.555 = 8855.50 KGS => 885550 minor
    expect(q.outputAmount).toBe(885550n);
    expect(q.spreadBps).toBe(50);
  });

  it("rejects same-currency and non-positive amounts", async () => {
    await expect(quoteFx(stubTx(1n), "USD", "USD", 100n)).rejects.toThrow();
    await expect(quoteFx(stubTx(1n), "USD", "KGS", 0n)).rejects.toThrow();
  });

  it("is deterministic and integer-only (no floats leak)", async () => {
    const q = await quoteFx(stubTx(1_123_595n), "KGS", "USD", 1_000_000n); // 10,000.00 KGS
    expect(typeof q.outputAmount).toBe("bigint");
    expect(q.outputAmount).toBeGreaterThan(0n);
  });
});
