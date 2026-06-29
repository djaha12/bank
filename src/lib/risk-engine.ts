import {
  AmlRuleCode,
  Currency,
  RiskLevel,
  TransactionType,
} from "@prisma/client";
import { subHours } from "date-fns";
import type { Tx } from "@/lib/db";

/**
 * ============================================================================
 * Rule-based Risk / AML engine (sandbox)
 * ----------------------------------------------------------------------------
 * Deterministic, explainable rules — NOT a real sanctions/AML system. A real
 * deployment must integrate a licensed transaction-monitoring + screening
 * provider and a human review workflow (see COMPLIANCE.md).
 *
 * The pure rule functions are unit-tested; `evaluateTransactionRisk` gathers
 * DB-derived signals and orchestrates them.
 * ============================================================================
 */

export const RISK_THRESHOLDS = {
  // Single large transaction (minor units).
  large: { KGS: 100_000_000n, USD: 1_000_000n, EUR: 1_000_000n } as Record<Currency, bigint>,
  // "Small" transfer ceiling used for structuring detection (minor units).
  small: { KGS: 9_000_000n, USD: 90_000n, EUR: 90_000n } as Record<Currency, bigint>,
  structuringCount: 8, // > N small transfers in 24h
  velocityCount: 12, // > N transactions in 1h
  failedLoginCount: 5, // > N failed logins in 1h
  aboveNormalMultiple: 5n, // amount > N * recent average
};

// Sandbox-only placeholder list. NOT real sanctions/geography. Real screening
// requires a licensed provider with maintained lists.
export const SANDBOX_HIGH_RISK_COUNTRIES = ["XA", "XB", "XC"];

export interface RuleHit {
  ruleCode: AmlRuleCode;
  level: RiskLevel;
  reason: string;
  details?: Record<string, unknown>;
}

const LEVEL_WEIGHT: Record<RiskLevel, number> = {
  LOW: 10,
  MEDIUM: 25,
  HIGH: 40,
  CRITICAL: 100,
};

// ---------------------------------------------------------------------------
// Pure rule functions (unit-tested)
// ---------------------------------------------------------------------------

export function largeTransactionRule(amount: bigint, currency: Currency): RuleHit | null {
  const threshold = RISK_THRESHOLDS.large[currency];
  if (amount <= threshold) return null;
  const level = amount > threshold * 5n ? RiskLevel.HIGH : RiskLevel.MEDIUM;
  return {
    ruleCode: AmlRuleCode.LARGE_TRANSACTION,
    level,
    reason: `Transaction amount ${amount} ${currency} exceeds large-transaction threshold ${threshold}`,
    details: { amount: amount.toString(), threshold: threshold.toString() },
  };
}

export function structuringRule(smallTransferCount: number): RuleHit | null {
  if (smallTransferCount <= RISK_THRESHOLDS.structuringCount) return null;
  return {
    ruleCode: AmlRuleCode.MANY_SMALL_TRANSFERS,
    level: RiskLevel.HIGH,
    reason: `${smallTransferCount} small transfers in 24h — possible structuring`,
    details: { smallTransferCount },
  };
}

export function velocityRule(txCountInWindow: number): RuleHit | null {
  if (txCountInWindow <= RISK_THRESHOLDS.velocityCount) return null;
  return {
    ruleCode: AmlRuleCode.VELOCITY,
    level: RiskLevel.MEDIUM,
    reason: `${txCountInWindow} transactions in the last hour — velocity spike`,
    details: { txCountInWindow },
  };
}

export function highRiskCountryRule(countryCode?: string | null): RuleHit | null {
  if (!countryCode) return null;
  if (!SANDBOX_HIGH_RISK_COUNTRIES.includes(countryCode.toUpperCase())) return null;
  return {
    ruleCode: AmlRuleCode.HIGH_RISK_COUNTRY,
    level: RiskLevel.HIGH,
    reason: `Counterparty country ${countryCode} is on the sandbox high-risk list`,
    details: { countryCode },
  };
}

export function newDeviceLargeTransferRule(
  newDevice: boolean,
  amount: bigint,
  currency: Currency,
): RuleHit | null {
  if (!newDevice) return null;
  const threshold = RISK_THRESHOLDS.large[currency] / 2n;
  if (amount <= threshold) return null;
  return {
    ruleCode: AmlRuleCode.NEW_DEVICE_LARGE_TRANSFER,
    level: RiskLevel.HIGH,
    reason: `Large transfer (${amount} ${currency}) from a new/untrusted device`,
    details: { amount: amount.toString() },
  };
}

export function failedLoginsRule(failedLoginCount: number): RuleHit | null {
  if (failedLoginCount <= RISK_THRESHOLDS.failedLoginCount) return null;
  return {
    ruleCode: AmlRuleCode.FAILED_LOGINS,
    level: RiskLevel.MEDIUM,
    reason: `${failedLoginCount} failed logins in the last hour`,
    details: { failedLoginCount },
  };
}

export function aboveNormalBehaviorRule(
  amount: bigint,
  recentAverage: bigint,
  currency: Currency,
): RuleHit | null {
  if (recentAverage <= 0n) return null;
  if (amount <= recentAverage * RISK_THRESHOLDS.aboveNormalMultiple) return null;
  return {
    ruleCode: AmlRuleCode.ABOVE_NORMAL_BEHAVIOR,
    level: RiskLevel.MEDIUM,
    reason: `Amount ${amount} ${currency} is >${RISK_THRESHOLDS.aboveNormalMultiple}x the recent average ${recentAverage}`,
    details: { amount: amount.toString(), recentAverage: recentAverage.toString() },
  };
}

export function unusualMerchantRule(mcc: string | null | undefined, knownMccs: string[]): RuleHit | null {
  if (!mcc) return null;
  if (knownMccs.includes(mcc)) return null;
  return {
    ruleCode: AmlRuleCode.UNUSUAL_MERCHANT,
    level: RiskLevel.LOW,
    reason: `First-time merchant category ${mcc} for this customer`,
    details: { mcc },
  };
}

/** Map a set of rule hits to a 0-100 score + level. */
export function scoreFromHits(hits: RuleHit[]): { score: number; level: RiskLevel } {
  const raw = hits.reduce((sum, h) => sum + LEVEL_WEIGHT[h.level], 0);
  const score = Math.min(100, raw);
  let level: RiskLevel = RiskLevel.LOW;
  if (score >= 80 || hits.some((h) => h.level === RiskLevel.CRITICAL)) level = RiskLevel.CRITICAL;
  else if (score >= 50) level = RiskLevel.HIGH;
  else if (score >= 20) level = RiskLevel.MEDIUM;
  return { score, level };
}

// ---------------------------------------------------------------------------
// Orchestration (DB-aware)
// ---------------------------------------------------------------------------

export interface TxRiskContext {
  userId: string;
  amount: bigint;
  currency: Currency;
  type: TransactionType;
  newDevice?: boolean;
  counterpartyCountry?: string | null;
  mcc?: string | null;
}

export async function evaluateTransactionRisk(
  tx: Tx,
  ctx: TxRiskContext,
): Promise<RuleHit[]> {
  const since24h = subHours(new Date(), 24);
  const since1h = subHours(new Date(), 1);

  const [smallTransferCount, recentTxCount, failedLogins, recentTransfers, knownMccRows] =
    await Promise.all([
      tx.transfer.count({
        where: {
          userId: ctx.userId,
          currency: ctx.currency,
          createdAt: { gte: since24h },
          amount: { lte: RISK_THRESHOLDS.small[ctx.currency] },
        },
      }),
      tx.transaction.count({
        where: { userId: ctx.userId, createdAt: { gte: since1h } },
      }),
      tx.loginEvent.count({
        where: { userId: ctx.userId, success: false, createdAt: { gte: since1h } },
      }),
      tx.transfer.findMany({
        where: { userId: ctx.userId, currency: ctx.currency },
        select: { amount: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      tx.hold.findMany({
        where: { account: { userId: ctx.userId }, mcc: { not: null } },
        select: { mcc: true },
        distinct: ["mcc"],
        take: 50,
      }),
    ]);

  const recentAverage =
    recentTransfers.length > 0
      ? recentTransfers.reduce((s, t) => s + t.amount, 0n) / BigInt(recentTransfers.length)
      : 0n;
  const knownMccs = knownMccRows.map((r) => r.mcc).filter((m): m is string => Boolean(m));

  const hits = [
    largeTransactionRule(ctx.amount, ctx.currency),
    structuringRule(smallTransferCount),
    velocityRule(recentTxCount),
    highRiskCountryRule(ctx.counterpartyCountry),
    newDeviceLargeTransferRule(ctx.newDevice ?? false, ctx.amount, ctx.currency),
    failedLoginsRule(failedLogins),
    aboveNormalBehaviorRule(ctx.amount, recentAverage, ctx.currency),
    unusualMerchantRule(ctx.mcc, knownMccs),
  ].filter((h): h is RuleHit => h !== null);

  return hits;
}

/**
 * Persist alerts for the given hits and refresh the user's current RiskScore.
 * Returns the created alerts + new score. Call inside the same tx as posting.
 */
export async function applyRiskOutcome(
  tx: Tx,
  userId: string,
  hits: RuleHit[],
  transactionId: string | null,
) {
  for (const hit of hits) {
    await tx.amlAlert.create({
      data: {
        userId,
        transactionId: transactionId ?? undefined,
        ruleCode: hit.ruleCode,
        level: hit.level,
        reason: hit.reason,
        details: (hit.details ?? {}) as object,
      },
    });
  }

  const { score, level } = scoreFromHits(hits);
  await tx.riskScore.updateMany({ where: { userId, current: true }, data: { current: false } });
  const riskScore = await tx.riskScore.create({
    data: {
      userId,
      score,
      level,
      current: true,
      factors: hits.map((h) => ({ rule: h.ruleCode, level: h.level, reason: h.reason })),
    },
  });

  return { alerts: hits.length, riskScore };
}
