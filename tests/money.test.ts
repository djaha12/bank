import { describe, it, expect } from "vitest";
import {
  toMinorUnits,
  fromMinorUnits,
  formatMoney,
  applyBps,
  addMoney,
  subMoney,
  serializeBigInt,
} from "@/lib/money";

describe("money minor-unit conversion", () => {
  it("parses decimal strings to minor units", () => {
    expect(toMinorUnits("1234.56", "USD")).toBe(123456n);
    expect(toMinorUnits("0.01", "KGS")).toBe(1n);
    expect(toMinorUnits("1000", "EUR")).toBe(100000n);
    expect(toMinorUnits(99.9, "USD")).toBe(9990n);
  });

  it("rejects malformed or over-precise amounts", () => {
    expect(() => toMinorUnits("1.234", "USD")).toThrow();
    expect(() => toMinorUnits("abc", "USD")).toThrow();
    expect(() => toMinorUnits("1.2.3", "USD")).toThrow();
  });

  it("round-trips minor units back to a decimal string", () => {
    for (const v of ["0.00", "1.05", "999999.99", "42.40"]) {
      expect(fromMinorUnits(toMinorUnits(v, "USD"), "USD")).toBe(v);
    }
  });

  it("formats with grouping and currency code", () => {
    expect(formatMoney(123456789n, "USD")).toBe("1,234,567.89 USD");
    expect(formatMoney(-5000n, "KGS", { signDisplay: "always" })).toBe("-50.00 KGS");
  });

  it("applies basis points with floor rounding", () => {
    expect(applyBps(100000n, 50)).toBe(500n); // 0.5%
    expect(applyBps(99n, 50)).toBe(0n); // floors
  });

  it("guards against currency mixing", () => {
    expect(addMoney({ amount: 1n, currency: "USD" }, { amount: 2n, currency: "USD" }).amount).toBe(3n);
    expect(() => subMoney({ amount: 1n, currency: "USD" }, { amount: 2n, currency: "KGS" })).toThrow();
  });

  it("serializes BigInt graphs to strings", () => {
    const out = serializeBigInt({ a: 1n, b: [2n, { c: 3n }], d: "x", e: new Date(0) });
    expect(out).toEqual({ a: "1", b: ["2", { c: "3" }], d: "x", e: new Date(0) });
  });
});
