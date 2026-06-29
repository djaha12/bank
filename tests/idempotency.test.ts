import { describe, it, expect } from "vitest";
import { canonicalJson, hashRequest } from "@/lib/idempotency";

describe("idempotency request hashing", () => {
  it("produces a stable hash regardless of key order", () => {
    const a = hashRequest({ amount: "100", to: "x", from: "y" });
    const b = hashRequest({ from: "y", to: "x", amount: "100" });
    expect(a).toBe(b);
  });

  it("changes the hash when the body changes", () => {
    expect(hashRequest({ amount: "100" })).not.toBe(hashRequest({ amount: "101" }));
  });

  it("canonicalizes nested structures deterministically", () => {
    expect(canonicalJson({ b: 1, a: [3, { d: 4, c: 5 }] })).toBe('{"a":[3,{"c":5,"d":4}],"b":1}');
  });
});
