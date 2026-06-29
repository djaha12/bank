import {
  AlertTriangle,
  PieChart,
  Repeat,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Currency } from "@prisma/client";
import { subDays } from "date-fns";
import { requirePageUser } from "@/lib/page-auth";
import { prisma } from "@/lib/db";
import { CURRENCY_META } from "@/lib/money";
import {
  spendingByCategory,
  cashflow,
  budgetProgress,
  detectSubscriptions,
} from "@/lib/analytics";
import { spendingInsight } from "@/lib/ai/service";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/brand/page-header";
import { MoneyText } from "@/components/brand/money-text";
import { AnimatedMoney, AnimatedNumber } from "@/components/brand/animated-number";
import { StatCard } from "@/components/brand/stat-card";
import { BentoGrid, BentoCard } from "@/components/brand/bento";
import { SpendingDonut, CashflowChart } from "@/components/brand/charts";
import { EmptyState } from "@/components/brand/states";

const PRIMARY: Currency = "KGS";

const BRAND_COLORS = [
  "#6366f1",
  "#38bdf8",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#a855f7",
  "#14b8a6",
  "#94a3b8",
];

/** Minor units (bigint) -> major-unit number for charts (2dp currencies). */
function toMajor(amount: bigint): number {
  return Number(amount) / 100;
}

export default async function AnalyticsPage() {
  const user = await requirePageUser();
  const since = subDays(new Date(), 30);

  const [categories, flow, budgets, subscriptions] = await Promise.all([
    spendingByCategory(user.id, PRIMARY, since),
    cashflow(user.id, PRIMARY, 6),
    budgetProgress(user.id),
    detectSubscriptions(user.id, PRIMARY),
  ]);

  // AI explanation (server-side, best-effort).
  let insightText: string | null = null;
  try {
    const insight = await spendingInsight(user.id, PRIMARY);
    insightText = insight.content;
  } catch {
    insightText = null;
  }

  const totalSpend = categories.reduce((s, c) => s + c.amount, 0n);
  const hasSpending = categories.length > 0 && totalSpend > 0n;

  // Donut data: MAJOR-unit numbers.
  const donutData = categories.map((c, i) => ({
    name: c.label,
    value: toMajor(c.amount),
    color: c.color ?? BRAND_COLORS[i % BRAND_COLORS.length],
  }));

  // Cashflow data for the chart (major-unit numbers).
  const flowData = flow.map((p) => ({
    month: p.month.slice(5), // "MM"
    inflow: toMajor(p.inflow),
    outflow: toMajor(p.outflow),
  }));
  const totalInflow = flow.reduce((s, p) => s + p.inflow, 0n);
  const totalOutflow = flow.reduce((s, p) => s + p.outflow, 0n);
  const netFlow = totalInflow - totalOutflow;

  const subsMonthly = subscriptions.reduce((s, sub) => s + sub.amount, 0n);

  // --- Anomaly detection (mock heuristic over the last 30 days) --------------
  // We surface the single largest category vs. the average as a "spike".
  const sorted = [...categories].sort((a, b) => (b.amount > a.amount ? 1 : -1));
  const top = sorted[0];
  const avg = categories.length > 0 ? totalSpend / BigInt(categories.length) : 0n;
  const anomaly =
    top && avg > 0n && top.amount > avg * 2n
      ? {
          label: top.label,
          amount: top.amount,
          multiple: Number((top.amount * 10n) / avg) / 10,
        }
      : null;

  return (
    <div className="space-y-8">
      <PageHeader
        title={
          <>
            Money <span className="text-gradient">analytics</span>
          </>
        }
        description="Where your money goes, your monthly cashflow, and smart, AI-assisted insights."
      />

      {/* Stat row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Spent (30 days)"
          accent="violet"
          index={0}
          value={<AnimatedMoney amount={totalSpend.toString()} currency={PRIMARY} />}
          hint={CURRENCY_META[PRIMARY].label}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <StatCard
          label="Money in (6 mo)"
          accent="emerald"
          index={1}
          value={<AnimatedMoney amount={totalInflow.toString()} currency={PRIMARY} />}
          hint="inflow"
          icon={<Wallet className="h-4 w-4" />}
        />
        <StatCard
          label="Net cashflow"
          accent="cyan"
          index={2}
          value={<MoneyText amount={netFlow} currency={PRIMARY} signed colored />}
          hint="last 6 months"
          icon={<PieChart className="h-4 w-4" />}
        />
        <StatCard
          label="Subscriptions"
          accent="blue"
          index={3}
          value={<AnimatedMoney amount={subsMonthly.toString()} currency={PRIMARY} />}
          hint={`${subscriptions.length} detected`}
          icon={<Repeat className="h-4 w-4" />}
        />
      </div>

      {/* Spending breakdown + AI insight — bento */}
      <BentoGrid className="lg:grid-cols-3">
        {/* Spending by category */}
        <BentoCard span={2} index={0} glow className="p-6">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold tracking-tight">
                Spending by category
              </h2>
              <p className="text-sm text-muted-foreground">
                Last 30 days · {CURRENCY_META[PRIMARY].label}
              </p>
            </div>
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-violet/30 to-brand-violet/5 text-brand-violet ring-1 ring-white/10">
              <PieChart className="h-4 w-4" />
            </span>
          </div>
          {!hasSpending ? (
            <EmptyState
              title="No spending yet"
              description="Make a card purchase to see your spending broken down by category."
              icon={<PieChart className="h-6 w-6" />}
            />
          ) : (
            <div className="grid items-center gap-6 sm:grid-cols-[240px_1fr]">
              <div className="relative">
                <SpendingDonut data={donutData} />
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">
                    Total
                  </span>
                  <span className="font-display text-lg font-semibold tabular-nums">
                    <MoneyText amount={totalSpend} currency={PRIMARY} withSymbol />
                  </span>
                </div>
              </div>
              <ul className="space-y-2.5">
                {categories.map((c, i) => {
                  const pct =
                    totalSpend > 0n ? Number((c.amount * 1000n) / totalSpend) / 10 : 0;
                  const color = c.color ?? BRAND_COLORS[i % BRAND_COLORS.length];
                  return (
                    <li
                      key={c.categoryKey}
                      className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-muted/40"
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-offset-2 ring-offset-card"
                        style={{ backgroundColor: color, boxShadow: `0 0 12px ${color}` }}
                      />
                      <span className="flex-1 truncate text-sm">{c.label}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {pct.toFixed(1)}%
                      </span>
                      <MoneyText
                        amount={c.amount}
                        currency={PRIMARY}
                        className="w-24 text-right text-sm font-semibold"
                      />
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </BentoCard>

        {/* AI explanation */}
        <BentoCard span={1} index={1} premium className="flex flex-col p-6">
          <div className="relative z-10 flex h-full flex-col justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-white/10 text-white ring-1 ring-white/20 backdrop-blur">
                  <Sparkles className="h-4 w-4" />
                </span>
                <h2 className="font-display text-base font-semibold tracking-tight text-white">
                  AI insight
                </h2>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-white/90">
                {insightText ??
                  "Spend a little and a personalized explanation of your spending will appear here."}
              </p>
            </div>
            <p className="text-[11px] leading-snug text-white/55">
              AI-generated for guidance only in this sandbox. Not financial, legal, or tax advice.
            </p>
          </div>
        </BentoCard>
      </BentoGrid>

      {/* Cashflow + Budgets — bento */}
      <BentoGrid className="lg:grid-cols-3">
        <BentoCard span={2} index={0} className="p-6">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold tracking-tight">
                Monthly cashflow
              </h2>
              <p className="text-sm text-muted-foreground">
                Inflow vs. outflow over the last 6 months
              </p>
            </div>
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-emerald/30 to-brand-emerald/5 text-brand-emerald ring-1 ring-white/10">
              <TrendingUp className="h-4 w-4" />
            </span>
          </div>
          {totalInflow === 0n && totalOutflow === 0n ? (
            <EmptyState
              title="No cashflow yet"
              description="Once you add money and start spending, your monthly cashflow shows up here."
              icon={<TrendingUp className="h-6 w-6" />}
            />
          ) : (
            <>
              <CashflowChart data={flowData} />
              <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span className="dot text-success" /> Inflow
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="dot text-primary" /> Outflow
                </span>
              </div>
            </>
          )}
        </BentoCard>

        {/* Budgets */}
        <BentoCard span={1} index={1} className="p-6">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold tracking-tight">
                Budget progress
              </h2>
              <p className="text-sm text-muted-foreground">This period</p>
            </div>
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-blue/30 to-brand-blue/5 text-brand-blue ring-1 ring-white/10">
              <Wallet className="h-4 w-4" />
            </span>
          </div>
          {budgets.length === 0 ? (
            <EmptyState
              title="No budgets set"
              description="Create budgets to track category spending against a limit."
              icon={<Wallet className="h-6 w-6" />}
            />
          ) : (
            <ul className="space-y-5">
              {budgets.map((b) => {
                const pct = Math.min(100, Math.max(0, b.pct));
                return (
                  <li key={b.id} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{b.name}</span>
                      {b.over ? (
                        <Badge variant="destructive">Over</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground tabular-nums">
                          <AnimatedNumber value={Math.round(b.pct)} suffix="%" />
                        </span>
                      )}
                    </div>
                    <Progress
                      value={pct}
                      className="h-2.5"
                      indicatorClassName={
                        b.over ? "bg-destructive" : b.pct > 80 ? "bg-warning" : "bg-brand-gradient"
                      }
                    />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <MoneyText amount={b.spent} currency={b.currency} />
                      <span>
                        of <MoneyText amount={b.limit} currency={b.currency} />
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </BentoCard>
      </BentoGrid>

      {/* Subscriptions + Anomaly — bento */}
      <BentoGrid className="lg:grid-cols-3">
        {/* Detected subscriptions */}
        <BentoCard span={2} index={0} className="p-6">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight">
                <Repeat className="h-4 w-4 text-brand-cyan" /> Detected subscriptions
              </h2>
              <p className="text-sm text-muted-foreground">
                Recurring merchants we spotted across two or more months.
              </p>
            </div>
          </div>
          {subscriptions.length === 0 ? (
            <EmptyState
              title="No subscriptions detected"
              description="Recurring payments to the same merchant will appear here automatically."
              icon={<Repeat className="h-6 w-6" />}
            />
          ) : (
            <ul className="divide-y divide-border/60">
              {subscriptions.map((sub) => (
                <li
                  key={sub.merchant}
                  className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-muted/40"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-cyan/25 to-brand-cyan/5 text-brand-cyan ring-1 ring-white/10">
                    <Repeat className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{sub.merchant}</div>
                    <div className="text-xs text-muted-foreground">
                      {sub.occurrences} payment{sub.occurrences === 1 ? "" : "s"} · recurring
                    </div>
                  </div>
                  <div className="text-right">
                    <MoneyText
                      amount={sub.amount}
                      currency={PRIMARY}
                      className="text-sm font-semibold"
                    />
                    <div className="text-[11px] text-muted-foreground">/ month</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </BentoCard>

        {/* Anomaly detection (mock) */}
        <BentoCard
          span={1}
          index={1}
          glow={!!anomaly}
          className={
            anomaly
              ? "border-warning/40 bg-warning/[0.06] p-6"
              : "border-success/30 bg-success/[0.05] p-6"
          }
        >
          <div className="mb-4 flex items-center gap-2">
            {anomaly ? (
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-warning/15 text-warning ring-1 ring-warning/30">
                <AlertTriangle className="h-4 w-4" />
              </span>
            ) : (
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-success/15 text-success ring-1 ring-success/30">
                <ShieldCheck className="h-4 w-4" />
              </span>
            )}
            <div>
              <h2 className="font-display text-base font-semibold tracking-tight">
                Anomaly detection
              </h2>
              <p className="text-xs text-muted-foreground">Behavioral monitoring (sandbox)</p>
            </div>
          </div>
          {anomaly ? (
            <div className="space-y-3">
              <p className="text-sm leading-relaxed">
                Spending on <span className="font-semibold">{anomaly.label}</span> is{" "}
                <span className="font-semibold text-warning">
                  {anomaly.multiple.toFixed(1)}×
                </span>{" "}
                your average category this month.
              </p>
              <div className="rounded-2xl border border-warning/30 bg-background/40 p-3">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  Flagged amount
                </div>
                <div className="mt-0.5 font-display text-lg font-semibold tabular-nums">
                  <MoneyText amount={anomaly.amount} currency={PRIMARY} withSymbol />
                </div>
              </div>
              <p className="text-[11px] leading-snug text-muted-foreground">
                Heuristic demo only. Real fraud monitoring uses richer signals.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm leading-relaxed text-muted-foreground">
                No unusual spending patterns detected in the last 30 days. Everything looks
                consistent with your typical activity.
              </p>
              <p className="text-[11px] leading-snug text-muted-foreground">
                Heuristic demo only. Real fraud monitoring uses richer signals.
              </p>
            </div>
          )}
        </BentoCard>
      </BentoGrid>
    </div>
  );
}
