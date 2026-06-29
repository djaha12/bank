import { describe, it, expect } from "vitest";
import { RiskLevel } from "@prisma/client";
import {
  largeTransactionRule,
  structuringRule,
  velocityRule,
  highRiskCountryRule,
  newDeviceLargeTransferRule,
  failedLoginsRule,
  aboveNormalBehaviorRule,
  unusualMerchantRule,
  scoreFromHits,
  RISK_THRESHOLDS,
  type RuleHit,
} from "@/lib/risk-engine";

describe("risk rules", () => {
  it("flags large transactions and escalates very large ones", () => {
    expect(largeTransactionRule(RISK_THRESHOLDS.large.USD, "USD")).toBeNull();
    const medium = largeTransactionRule(RISK_THRESHOLDS.large.USD + 1n, "USD");
    expect(medium?.level).toBe(RiskLevel.MEDIUM);
    const high = largeTransactionRule(RISK_THRESHOLDS.large.USD * 6n, "USD");
    expect(high?.level).toBe(RiskLevel.HIGH);
  });

  it("detects structuring above the small-transfer count", () => {
    expect(structuringRule(RISK_THRESHOLDS.structuringCount)).toBeNull();
    expect(structuringRule(RISK_THRESHOLDS.structuringCount + 1)?.level).toBe(RiskLevel.HIGH);
  });

  it("detects velocity spikes", () => {
    expect(velocityRule(RISK_THRESHOLDS.velocityCount)).toBeNull();
    expect(velocityRule(RISK_THRESHOLDS.velocityCount + 5)).not.toBeNull();
  });

  it("flags sandbox high-risk countries only", () => {
    expect(highRiskCountryRule("KG")).toBeNull();
    expect(highRiskCountryRule("XA")?.level).toBe(RiskLevel.HIGH);
    expect(highRiskCountryRule(null)).toBeNull();
  });

  it("flags large transfers from a new device", () => {
    const threshold = RISK_THRESHOLDS.large.USD / 2n;
    expect(newDeviceLargeTransferRule(false, threshold + 1n, "USD")).toBeNull();
    expect(newDeviceLargeTransferRule(true, threshold + 1n, "USD")?.level).toBe(RiskLevel.HIGH);
    expect(newDeviceLargeTransferRule(true, threshold - 1n, "USD")).toBeNull();
  });

  it("flags excessive failed logins", () => {
    expect(failedLoginsRule(RISK_THRESHOLDS.failedLoginCount)).toBeNull();
    expect(failedLoginsRule(RISK_THRESHOLDS.failedLoginCount + 1)).not.toBeNull();
  });

  it("flags amounts far above the customer's normal", () => {
    expect(aboveNormalBehaviorRule(100n, 0n, "USD")).toBeNull(); // no history
    expect(aboveNormalBehaviorRule(100n, 100n, "USD")).toBeNull();
    expect(aboveNormalBehaviorRule(100n * 6n, 100n, "USD")).not.toBeNull();
  });

  it("flags first-time merchant categories", () => {
    expect(unusualMerchantRule("5411", ["5411", "5812"])).toBeNull();
    expect(unusualMerchantRule("9999", ["5411"])?.level).toBe(RiskLevel.LOW);
    expect(unusualMerchantRule(null, [])).toBeNull();
  });

  it("aggregates hits into a 0-100 score and level, critical on any critical hit", () => {
    expect(scoreFromHits([]).level).toBe(RiskLevel.LOW);
    const hits: RuleHit[] = [
      { ruleCode: "LARGE_TRANSACTION", level: RiskLevel.MEDIUM, reason: "x" },
      { ruleCode: "MANY_SMALL_TRANSFERS", level: RiskLevel.HIGH, reason: "y" },
    ];
    const res = scoreFromHits(hits);
    expect(res.score).toBe(65);
    expect(res.level).toBe(RiskLevel.HIGH);
    const critical = scoreFromHits([{ ruleCode: "SANCTIONS_HIT", level: RiskLevel.CRITICAL, reason: "z" }]);
    expect(critical.level).toBe(RiskLevel.CRITICAL);
  });
});
