import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CreditCard,
  Plus,
  Repeat,
  Send,
  Sparkles,
  Wallet,
  PiggyBank,
  TrendingUp,
} from "lucide-react";
import { Currency, LedgerDirection } from "@prisma/client";
import { startOfMonth, subDays, format } from "date-fns";
import { requirePageUser } from "@/lib/page-auth";
import { prisma } from "@/lib/db";
import { CURRENCY_META, fromMinorUnits } from "@/lib/money";
import { spendingInsight } from "@/lib/ai/service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/brand/page-header";
import { StatCard } from "@/components/brand/stat-card";
import { MoneyText } from "@/components/brand/money-text";
import { BalanceArea } from "@/components/brand/charts";
import { EmptyState } from "@/components/brand/states";

const PRIMARY: Currency = "KGS";

const CURRENCY_FLAG: Record<Currency, string> = { KGS: "🇰🇬", USD: "🇺🇸", EUR: "🇪🇺" };

function txnLabel(type: string): string {
  return type
    .toLowerCase()
    .split("_")
    .map((w) => (w.length ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export default async function DashboardPage() {
  const user = await requirePageUser();
  const firstName = user.firstName?.trim() || user.email.split("@")[0] || "there";

  const monthStart = startOfMonth(new Date());

  const [accounts, cards, savingsGoals, recentEntries, monthDebits, balanceSeriesRows] =
    await Promise.all([
      prisma.account.findMany({
        where: { userId: user.id, deletedAt: null, ownerType: "USER" },
        orderBy: { createdAt: "asc" },
      }),
      prisma.card.count({ where: { userId: user.id, deletedAt: null, status: "ACTIVE" } }),
      prisma.savingsGoal.findMany({
        where: { userId: user.id, status: "ACTIVE" },
        select: { currency: true, currentAmount: true },
      }),
      prisma.ledgerEntry.findMany({
        where: { account: { userId: user.id } },
        orderBy: { createdAt: "desc" },
        take: 8,
        include: {
          transaction: { select: { type: true, description: true, reference: true } },
          account: { select: { name: true } },
        },
      }),
      prisma.ledgerEntry.findMany({
        where: {
          account: { userId: user.id },
          direction: LedgerDirection.DEBIT,
          currency: PRIMARY,
          createdAt: { gte: monthStart },
        },
        select: { amount: true },
      }),
      // Last 30 days of primary-currency entries to derive a balance sparkline.
      prisma.ledgerEntry.findMany({
        where: {
          account: { userId: user.id },
          currency: PRIMARY,
          createdAt: { gte: subDays(new Date(), 30) },
        },
        orderBy: { createdAt: "asc" },
        select: { balanceAfter: true, createdAt: true },
      }),
    ]);

  // Sum balances per currency.
  const totalsByCurrency = new Map<Currency, bigint>();
  for (const acc of accounts) {
    totalsByCurrency.set(acc.currency, (totalsByCurrency.get(acc.currency) ?? 0n) + acc.balanceCached);
  }
  const primaryTotal = totalsByCurrency.get(PRIMARY) ?? 0n;
  const otherTotals = [...totalsByCurrency.entries()].filter(([c]) => c !== PRIMARY);

  const monthSpend = monthDebits.reduce((s, e) => s + e.amount, 0n);

  const savingsTotal = savingsGoals
    .filter((g) => g.currency === PRIMARY)
    .reduce((s, g) => s + g.currentAmount, 0n);

  // Build a small balance series for the sparkline (last point per day, primary ccy).
  const byDay = new Map<string, bigint>();
  for (const row of balanceSeriesRows) {
    byDay.set(format(row.createdAt, "MMM d"), row.balanceAfter);
  }
  let balanceSeries = [...byDay.entries()].map(([label, value]) => ({
    label,
    value: Number(fromMinorUnits(value, PRIMARY)),
  }));
  if (balanceSeries.length < 2) {
    const flat = Number(fromMinorUnits(primaryTotal, PRIMARY));
    balanceSeries = [
      { label: "start", value: flat },
      { label: "now", value: flat },
    ];
  }

  // AI insight (server-side, best-effort).
  let insightText: string | null = null;
  try {
    const insight = await spendingInsight(user.id, PRIMARY);
    insightText = insight.content;
  } catch {
    insightText = null;
  }

  const hasAnyAccount = accounts.length > 0;

  const quickActions = [
    { href: "/transfers", label: "Send", icon: Send, variant: "gradient" as const },
    { href: "/transfers?deposit=1", label: "Add money", icon: Plus, variant: "outline" as const },
    { href: "/transfers?tab=fx", label: "Exchange", icon: Repeat, variant: "outline" as const },
    { href: "/cards?new=1", label: "New card", icon: CreditCard, variant: "outline" as const },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description="Here's a snapshot of your money across every account."
      />

      {/* Hero: total balance */}
      <Card className="premium-surface border-white/10 p-0 text-white">
        <div className="bg-radial-glow grid gap-6 p-6 md:grid-cols-[1.2fr_1fr] md:p-8">
          <div className="flex flex-col justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 text-sm text-white/70">
                <Wallet className="h-4 w-4" />
                Total balance · {CURRENCY_META[PRIMARY].label}
              </div>
              <div className="mt-3 text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl">
                <MoneyText amount={primaryTotal} currency={PRIMARY} withSymbol />
              </div>
              {otherTotals.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {otherTotals.map(([ccy, total]) => (
                    <span
                      key={ccy}
                      className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-sm backdrop-blur"
                    >
                      <span>{CURRENCY_FLAG[ccy]}</span>
                      <MoneyText amount={total} currency={ccy} withSymbol className="text-white/90" />
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {quickActions.map((a) => (
                <Button key={a.label} asChild variant={a.variant} size="sm">
                  <Link href={a.href}>
                    <a.icon className="h-4 w-4" />
                    {a.label}
                  </Link>
                </Button>
              ))}
            </div>
          </div>
          <div className="flex flex-col justify-end">
            <div className="text-xs uppercase tracking-widest text-white/60">30-day trend</div>
            <BalanceArea data={balanceSeries} />
          </div>
        </div>
      </Card>

      {/* Stat row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total balance"
          value={<MoneyText amount={primaryTotal} currency={PRIMARY} />}
          hint={CURRENCY_META[PRIMARY].label}
          icon={<Wallet className="h-4 w-4 text-primary" />}
        />
        <StatCard
          label="Spent this month"
          value={<MoneyText amount={monthSpend} currency={PRIMARY} />}
          hint={format(new Date(), "MMMM")}
          icon={<TrendingUp className="h-4 w-4 text-primary" />}
        />
        <StatCard
          label="Active cards"
          value={cards.toString()}
          hint={cards === 1 ? "card" : "cards"}
          icon={<CreditCard className="h-4 w-4 text-primary" />}
        />
        <StatCard
          label="Savings"
          value={<MoneyText amount={savingsTotal} currency={PRIMARY} />}
          hint={`${savingsGoals.length} goal${savingsGoals.length === 1 ? "" : "s"}`}
          icon={<PiggyBank className="h-4 w-4 text-primary" />}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent transactions */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Recent activity</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/accounts">View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentEntries.length === 0 ? (
              <EmptyState
                title="No transactions yet"
                description="Add money or make a transfer to see your activity here."
                icon={<Wallet className="h-6 w-6" />}
                action={
                  <Button asChild variant="gradient" size="sm">
                    <Link href="/transfers?deposit=1">Add money</Link>
                  </Button>
                }
              />
            ) : (
              <ul className="divide-y divide-border/60">
                {recentEntries.map((e) => {
                  const inflow = e.direction === LedgerDirection.CREDIT;
                  const signed = inflow ? e.amount : -e.amount;
                  const title =
                    e.transaction.description ?? txnLabel(e.transaction.type);
                  return (
                    <li key={e.id} className="flex items-center gap-3 py-3">
                      <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                          inflow ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {inflow ? (
                          <ArrowDownLeft className="h-4 w-4" />
                        ) : (
                          <ArrowUpRight className="h-4 w-4" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{title}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {e.account.name} · {format(e.createdAt, "MMM d, HH:mm")}
                        </div>
                      </div>
                      <MoneyText
                        amount={signed}
                        currency={e.currency}
                        signed
                        colored
                        className="text-sm font-semibold"
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* AI insight */}
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
                Spend a little and your personalized insights will appear here.
              </p>
            )}
            <p className="text-[11px] leading-snug text-muted-foreground">
              AI-generated for guidance only in this sandbox. Not financial advice.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Accounts mini-cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Your accounts</h2>
          <Button asChild variant="ghost" size="sm">
            <Link href="/accounts">Manage</Link>
          </Button>
        </div>
        {!hasAnyAccount ? (
          <EmptyState
            title="No accounts yet"
            description="Your accounts will appear here once your profile is set up."
            icon={<Wallet className="h-6 w-6" />}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {accounts.map((acc) => {
              const available = acc.balanceCached - acc.holdTotal;
              return (
                <Link key={acc.id} href={`/accounts/${acc.id}`} className="group">
                  <Card className="h-full p-5 transition-all hover:border-primary/40 hover:shadow-glow">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{CURRENCY_FLAG[acc.currency]}</span>
                        <div>
                          <div className="text-sm font-medium leading-tight">{acc.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {acc.currency} · ••{acc.displayNumber}
                          </div>
                        </div>
                      </div>
                      <Badge variant={acc.status === "ACTIVE" ? "success" : "warning"}>
                        {acc.status.toLowerCase()}
                      </Badge>
                    </div>
                    <div className="mt-4 text-2xl font-semibold tracking-tight tabular-nums">
                      <MoneyText amount={acc.balanceCached} currency={acc.currency} withSymbol />
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Available{" "}
                      <MoneyText amount={available} currency={acc.currency} withSymbol />
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
