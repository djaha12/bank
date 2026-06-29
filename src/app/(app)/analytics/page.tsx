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
import { CURRENCY_META, fromMinorUnits } from "@/lib/money";
import {
  spendingByCategory,
  cashflow,
  budgetProgress,
  detectSubscriptions,
} from "@/lib/analytics";
import { spendingInsight } from "@/lib/ai/service";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/brand/page-header";
import { MoneyText } from "@/components/brand/money-text";
import { StatCard } from "@/components/brand/stat-card";
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
        title="Analytics"
        description="Where your money goes, your monthly cashflow, and smart, AI-assisted insights."
      />

      {/* Stat row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Spent (30 days)"
          value={<MoneyText amount={totalSpend} currency={PRIMARY} />}
          hint={CURRENCY_META[PRIMARY].label}
          icon={<TrendingUp className="h-4 w-4 text-primary" />}
        />
        <StatCard
          label="Money in (6 mo)"
          value={<MoneyText amount={totalInflow} currency={PRIMARY} />}
          icon={<Wallet className="h-4 w-4 text-success" />}
        />
        <StatCard
          label="Net cashflow"
          value={<MoneyText amount={netFlow} currency={PRIMARY} signed colored />}
          hint="last 6 months"
          icon={<PieChart className="h-4 w-4 text-primary" />}
        />
        <StatCard
          label="Subscriptions"
          value={<MoneyText amount={subsMonthly} currency={PRIMARY} />}
          hint={`${subscriptions.length} detected`}
          icon={<Repeat className="h-4 w-4 text-primary" />}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Spending by category */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Spending by category</CardTitle>
            <CardDescription>Last 30 days · {CURRENCY_META[PRIMARY].label}</CardDescription>
          </CardHeader>
          <CardContent>
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
                    <span className="text-xs text-muted-foreground">Total</span>
                    <span className="text-lg font-semibold tabular-nums">
                      <MoneyText amount={totalSpend} currency={PRIMARY} withSymbol />
                    </span>
                  </div>
                </div>
                <ul className="space-y-3">
                  {categories.map((c, i) => {
                    const pct =
                      totalSpend > 0n ? Number((c.amount * 1000n) / totalSpend) / 10 : 0;
                    const color = c.color ?? BRAND_COLORS[i % BRAND_COLORS.length];
                    return (
                      <li key={c.categoryKey} className="flex items-center gap-3">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                        <span className="flex-1 truncate text-sm">{c.label}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {pct.toFixed(1)}%
                        </span>
                        <MoneyText
                          amount={c.amount}
                          currency={PRIMARY}
                          className="text-sm font-semibold"
                        />
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        {/* AI explanation */}
        <Card className="glass-card flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-gradient text-white shadow-glow">
                <Sparkles className="h-4 w-4" />
              </span>
              AI insight
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col justify-between gap-4">
            {insightText ? (
              <p className="text-sm leading-relaxed text-foreground/90">{insightText}</p>
            ) : (
              <p className="text-sm leading-relaxed text-muted-foreground">
                Spend a little and a personalized explanation of your spending will appear here.
              </p>
            )}
            <p className="text-[11px] leading-snug text-muted-foreground">
              AI-generated for guidance only in this sandbox. Not financial, legal, or tax advice.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Cashflow + Budgets */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Monthly cashflow</CardTitle>
            <CardDescription>Inflow vs. outflow over the last 6 months</CardDescription>
          </CardHeader>
          <CardContent>
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
                    <span className="h-2.5 w-2.5 rounded-full bg-success" /> Inflow
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-primary" /> Outflow
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Budgets */}
        <Card>
          <CardHeader>
            <CardTitle>Budget progress</CardTitle>
            <CardDescription>This period</CardDescription>
          </CardHeader>
          <CardContent>
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
                            {Math.round(b.pct)}%
                          </span>
                        )}
                      </div>
                      <Progress
                        value={pct}
                        indicatorClassName={
                          b.over ? "bg-destructive" : b.pct > 80 ? "bg-warning" : "bg-primary"
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
          </CardContent>
        </Card>
      </div>

      {/* Subscriptions + Anomaly */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Detected subscriptions */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Repeat className="h-4 w-4 text-primary" /> Detected subscriptions
            </CardTitle>
            <CardDescription>
              Recurring merchants we spotted across two or more months.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {subscriptions.length === 0 ? (
              <EmptyState
                title="No subscriptions detected"
                description="Recurring payments to the same merchant will appear here automatically."
                icon={<Repeat className="h-6 w-6" />}
              />
            ) : (
              <ul className="divide-y divide-border/60">
                {subscriptions.map((sub) => (
                  <li key={sub.merchant} className="flex items-center gap-3 py-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
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
          </CardContent>
        </Card>

        {/* Anomaly detection (mock) */}
        <Card
          className={
            anomaly
              ? "border-warning/40 bg-warning/5"
              : "border-success/30 bg-success/5"
          }
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {anomaly ? (
                <AlertTriangle className="h-4 w-4 text-warning" />
              ) : (
                <ShieldCheck className="h-4 w-4 text-success" />
              )}
              Anomaly detection
            </CardTitle>
            <CardDescription>Behavioral monitoring (sandbox)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {anomaly ? (
              <>
                <p className="text-sm leading-relaxed">
                  Spending on{" "}
                  <span className="font-semibold">{anomaly.label}</span> is{" "}
                  <span className="font-semibold text-warning">
                    {anomaly.multiple.toFixed(1)}×
                  </span>{" "}
                  your average category this month.
                </p>
                <div className="rounded-lg border border-warning/30 bg-background/40 p-3">
                  <div className="text-xs text-muted-foreground">Flagged amount</div>
                  <div className="text-lg font-semibold tabular-nums">
                    <MoneyText amount={anomaly.amount} currency={PRIMARY} withSymbol />
                  </div>
                </div>
                <p className="text-[11px] leading-snug text-muted-foreground">
                  Heuristic demo only. Real fraud monitoring uses richer signals.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  No unusual spending patterns detected in the last 30 days. Everything looks
                  consistent with your typical activity.
                </p>
                <p className="text-[11px] leading-snug text-muted-foreground">
                  Heuristic demo only. Real fraud monitoring uses richer signals.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
