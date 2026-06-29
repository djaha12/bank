import { describe, it, expect } from "vitest";
import { LedgerDirection, TransactionType } from "@prisma/client";
import {
  assertBalancedPlan,
  balanceDeltas,
  legDelta,
  LedgerError,
  type PostingPlan,
} from "@/lib/ledger";

const D = LedgerDirection.DEBIT;
const Cr = LedgerDirection.CREDIT;

function plan(legs: PostingPlan["legs"]): PostingPlan {
  return { type: TransactionType.INTERNAL_TRANSFER, currency: "KGS", amount: 1000n, legs };
}

describe("double-entry invariants", () => {
  it("accepts a balanced same-currency posting", () => {
    expect(() =>
      assertBalancedPlan(
        plan([
          { accountId: "a", direction: D, amount: 1000n, currency: "KGS" },
          { accountId: "b", direction: Cr, amount: 1000n, currency: "KGS" },
        ]),
      ),
    ).not.toThrow();
  });

  it("rejects an unbalanced posting", () => {
    expect(() =>
      assertBalancedPlan(
        plan([
          { accountId: "a", direction: D, amount: 1000n, currency: "KGS" },
          { accountId: "b", direction: Cr, amount: 999n, currency: "KGS" },
        ]),
      ),
    ).toThrow(LedgerError);
  });

  it("balances PER CURRENCY for a cross-currency (FX) posting", () => {
    expect(() =>
      assertBalancedPlan({
        type: TransactionType.FX_CONVERSION,
        currency: "USD",
        amount: 10000n,
        legs: [
          { accountId: "userUsd", direction: D, amount: 10000n, currency: "USD" },
          { accountId: "fxUsd", direction: Cr, amount: 10000n, currency: "USD" },
          { accountId: "fxKgs", direction: D, amount: 890000n, currency: "KGS" },
          { accountId: "userKgs", direction: Cr, amount: 890000n, currency: "KGS" },
        ],
      }),
    ).not.toThrow();
  });

  it("rejects an FX posting unbalanced in one currency", () => {
    expect(() =>
      assertBalancedPlan({
        type: TransactionType.FX_CONVERSION,
        currency: "USD",
        amount: 10000n,
        legs: [
          { accountId: "userUsd", direction: D, amount: 10000n, currency: "USD" },
          { accountId: "fxUsd", direction: Cr, amount: 10000n, currency: "USD" },
          { accountId: "fxKgs", direction: D, amount: 890000n, currency: "KGS" },
          { accountId: "userKgs", direction: Cr, amount: 880000n, currency: "KGS" },
        ],
      }),
    ).toThrow(/Unbalanced KGS/);
  });

  it("rejects non-positive and too-few legs", () => {
    expect(() => assertBalancedPlan(plan([{ accountId: "a", direction: D, amount: 1000n, currency: "KGS" }]))).toThrow(
      /two legs/,
    );
    expect(() =>
      assertBalancedPlan(
        plan([
          { accountId: "a", direction: D, amount: 0n, currency: "KGS" },
          { accountId: "b", direction: Cr, amount: 0n, currency: "KGS" },
        ]),
      ),
    ).toThrow(/positive/);
  });

  it("computes signed leg deltas (credit +, debit -) and per-account net", () => {
    expect(legDelta({ direction: Cr, amount: 500n })).toBe(500n);
    expect(legDelta({ direction: D, amount: 500n })).toBe(-500n);
    const deltas = balanceDeltas(
      plan([
        { accountId: "a", direction: D, amount: 1000n, currency: "KGS" },
        { accountId: "b", direction: Cr, amount: 1000n, currency: "KGS" },
      ]),
    );
    expect(deltas.get("a")).toBe(-1000n);
    expect(deltas.get("b")).toBe(1000n);
  });
});
