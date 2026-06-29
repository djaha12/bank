import { Currency, TransactionType } from "@prisma/client";
import { startOfMonth, subMonths, format } from "date-fns";
import { prisma } from "@/lib/db";

/**
 * Deterministic spending/cashflow analytics. These are plain computations over
 * the ledger — NOT "AI". The AI layer phrases them; the analytics endpoints
 * return them directly.
 */

export interface CategorySpend {
  categoryKey: string;
  label: string;
  color: string | null;
  amount: bigint;
  count: number;
}

async function categoryForMcc(): Promise<{ key: string; label: string; color: string | null; prefixes: string[] }[]> {
  const cats = await prisma.spendingCategory.findMany();
  return cats.map((c) => ({ key: c.key, label: c.label, color: c.color, prefixes: c.mccPrefixes }));
}

function matchCategory(
  mcc: string | null,
  cats: { key: string; label: string; color: string | null; prefixes: string[] }[],
) {
  if (mcc) {
    for (const c of cats) {
      if (c.prefixes.some((p) => mcc.startsWith(p))) return c;
    }
  }
  return { key: "other", label: "Other", color: "#94a3b8", prefixes: [] };
}

export async function spendingByCategory(
  userId: string,
  currency: Currency,
  since: Date,
): Promise<CategorySpend[]> {
  const [holds, cats] = await Promise.all([
    prisma.hold.findMany({
      where: {
        account: { userId },
        currency,
        status: { in: ["CAPTURED", "HELD"] },
        createdAt: { gte: since },
      },
      select: { amount: true, mcc: true },
    }),
    categoryForMcc(),
  ]);

  const map = new Map<string, CategorySpend>();
  for (const h of holds) {
    const cat = matchCategory(h.mcc, cats);
    const cur = map.get(cat.key) ?? { categoryKey: cat.key, label: cat.label, color: cat.color, amount: 0n, count: 0 };
    cur.amount += h.amount;
    cur.count += 1;
    map.set(cat.key, cur);
  }
  return [...map.values()].sort((a, b) => (b.amount > a.amount ? 1 : -1));
}

export interface CashflowPoint {
  month: string; // "2026-06"
  inflow: bigint;
  outflow: bigint;
  net: bigint;
}

const OUTFLOW_TYPES: TransactionType[] = [
  TransactionType.INTERNAL_TRANSFER,
  TransactionType.P2P_TRANSFER,
  TransactionType.CARD_CAPTURE,
  TransactionType.FX_CONVERSION,
  TransactionType.FEE,
];
const INFLOW_TYPES: TransactionType[] = [
  TransactionType.DEMO_DEPOSIT,
  TransactionType.REFUND,
  TransactionType.REVERSAL,
];

export async function cashflow(
  userId: string,
  currency: Currency,
  months = 6,
): Promise<CashflowPoint[]> {
  const since = startOfMonth(subMonths(new Date(), months - 1));
  const txns = await prisma.transaction.findMany({
    where: {
      userId,
      currency,
      status: "COMPLETED",
      createdAt: { gte: since },
    },
    select: { amount: true, type: true, createdAt: true },
  });

  const points = new Map<string, CashflowPoint>();
  for (let i = 0; i < months; i++) {
    const d = subMonths(new Date(), months - 1 - i);
    const key = format(d, "yyyy-MM");
    points.set(key, { month: key, inflow: 0n, outflow: 0n, net: 0n });
  }
  for (const t of txns) {
    const key = format(t.createdAt, "yyyy-MM");
    const p = points.get(key);
    if (!p) continue;
    if (INFLOW_TYPES.includes(t.type)) p.inflow += t.amount;
    else if (OUTFLOW_TYPES.includes(t.type)) p.outflow += t.amount;
    p.net = p.inflow - p.outflow;
  }
  return [...points.values()];
}

export interface BudgetProgress {
  id: string;
  name: string;
  currency: Currency;
  limit: bigint;
  spent: bigint;
  pct: number;
  over: boolean;
}

export async function budgetProgress(userId: string): Promise<BudgetProgress[]> {
  const budgets = await prisma.budget.findMany({ where: { userId } });
  return budgets.map((b) => {
    const pct = b.limitAmount > 0n ? Number((b.spentCached * 100n) / b.limitAmount) : 0;
    return {
      id: b.id,
      name: b.name,
      currency: b.currency,
      limit: b.limitAmount,
      spent: b.spentCached,
      pct,
      over: b.spentCached > b.limitAmount,
    };
  });
}

/** Naive subscription detection: same merchant seen in >= 2 distinct months. */
export async function detectSubscriptions(userId: string, currency: Currency) {
  const holds = await prisma.hold.findMany({
    where: { account: { userId }, currency, merchantName: { not: null } },
    select: { merchantName: true, amount: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const byMerchant = new Map<string, { months: Set<string>; amount: bigint; count: number }>();
  for (const h of holds) {
    const name = h.merchantName ?? "";
    const cur = byMerchant.get(name) ?? { months: new Set<string>(), amount: 0n, count: 0 };
    cur.months.add(format(h.createdAt, "yyyy-MM"));
    cur.amount = h.amount; // latest amount
    cur.count += 1;
    byMerchant.set(name, cur);
  }
  return [...byMerchant.entries()]
    .filter(([, v]) => v.months.size >= 2)
    .map(([merchant, v]) => ({ merchant, amount: v.amount, occurrences: v.count }));
}
