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
import { AnimatedMoney } from "@/components/brand/animated-number";
import { BalanceArea } from "@/components/brand/charts";
import { VirtualCard } from "@/components/brand/virtual-card";
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

  const [accounts, cardCount, firstCard, savingsGoals, recentEntries, monthDebits, balanceSeriesRows] =
    await Promise.all([
      prisma.account.findMany({
        where: { userId: user.id, deletedAt: null, ownerType: "USER" },
        orderBy: { createdAt: "asc" },
      }),
      prisma.card.count({ where: { userId: user.id, deletedAt: null, status: "ACTIVE" } }),
      prisma.card.findFirst({
        where: { userId: user.id, deletedAt: null },
        include: { account: { select: { currency: true } } },
        orderBy: { createdAt: "asc" },
      }),
      prisma.savingsGoal.findMany({
        where: { userId: user.id, status: "ACTIVE" },
        select: { currency: true, currentAmount: true },
      }),
      prisma.ledgerEntry.findMany({
        where: { account: { userId: user.id } },
        orderBy: { createdAt: "desc" },
        take: 7,
        include: {
          transaction: { select: { type: true, description: true } },
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

  // Sample the raw balance trail (not collapsed by day) so the sparkline shows
  // real intra-period movement.
  let balanceSeries = balanceSeriesRows.map((r, i) => ({
    label: format(r.createdAt, "MMM d"),
    value: Number(fromMinorUnits(r.balanceAfter, PRIMARY)),
    _i: i,
  }));
  if (balanceSeries.length > 16) {
    const step = Math.ceil(balanceSeries.length / 16);
    balanceSeries = balanceSeries.filter((_, i) => i % step === 0);
  }
  if (balanceSeries.length < 2) {
    const flat = Number(fromMinorUnits(primaryTotal, PRIMARY));
    balanceSeries = [
      { label: "start", value: flat * 0.94, _i: 0 },
      { label: "now", value: flat, _i: 1 },
    ];
  }

  let insightText: string | null = null;
  try {
    insightText = (await spendingInsight(user.id, PRIMARY)).content;
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
        title={
          <>
            Welcome back, <span className="text-gradient">{firstName}</span>
          </>
        }
        description="Here's a live snapshot of your money across every account."
      />

      {/* Hero — premium balance + floating virtual card */}
      <section className="premium-surface ring-glow relative grid gap-8 p-6 md:grid-cols-[1.1fr_0.9fr] md:p-9">
        <div className="relative z-10 flex flex-col justify-between gap-8 text-white">
          <div>
            <div className="flex items-center gap-2 text-sm text-white/70">
              <span className="dot text-brand-emerald" />
              Total balance · {CURRENCY_META[PRIMARY].label}
            </div>
            <AnimatedMoney
              amount={primaryTotal.toString()}
              currency={PRIMARY}
              withSymbol
              className="mt-3 block font-display text-5xl font-semibold leading-none tracking-tight sm:text-6xl"
            />
            {otherTotals.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {otherTotals.map(([ccy, total]) => (
                  <span
                    key={ccy}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-sm backdrop-blur"
                  >
                    <span>{CURRENCY_FLAG[ccy]}</span>
                    <MoneyText amount={total} currency={ccy} withSymbol className="text-white/90" />
                  </span>
                ))}
              </div>
            )}
            <div className="mt-6 -mx-2 max-w-sm opacity-90">
              <BalanceArea data={balanceSeries} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {quickActions.map((a) => (
              <Button key={a.label} asChild variant={a.variant} size="sm"
                className={a.variant === "outline" ? "border-white/20 bg-white/5 text-white hover:bg-white/15" : ""}>
                <Link href={a.href}>
                  <a.icon className="h-4 w-4" />
                  {a.label}
                </Link>
              </Button>
            ))}
          </div>
        </div>
        <div className="relative z-10 flex items-center justify-center">
          {firstCard ? (
            <div className="animate-float">
              <VirtualCard
                last4={firstCard.last4}
                holder={firstCard.cardholderName}
                expMonth={firstCard.expMonth}
                expYear={firstCard.expYear}
                currency={firstCard.account.currency}
                frozen={firstCard.status === "FROZEN"}
              />
            </div>
          ) : (
            <Button asChild variant="gradient" size="lg">
              <Link href="/cards?new=1">
                <CreditCard className="h-5 w-5" /> Create a virtual card
              </Link>
            </Button>
          )}
        </div>
      </section>

      {/* Stat tiles */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total balance"
          accent="violet"
          index={0}
          value={<AnimatedMoney amount={primaryTotal.toString()} currency={PRIMARY} />}
          hint={CURRENCY_META[PRIMARY].label}
          icon={<Wallet className="h-4 w-4" />}
        />
        <StatCard
          label="Spent this month"
          accent="cyan"
          index={1}
          value={<AnimatedMoney amount={monthSpend.toString()} currency={PRIMARY} />}
          hint={format(new Date(), "MMMM")}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <StatCard
          label="Active cards"
          accent="blue"
          index={2}
          value={cardCount.toString()}
          hint={cardCount === 1 ? "card" : "cards"}
          icon={<CreditCard className="h-4 w-4" />}
        />
        <StatCard
          label="Savings"
          accent="emerald"
          index={3}
          value={<AnimatedMoney amount={savingsTotal.toString()} currency={PRIMARY} />}
          hint={`${savingsGoals.length} goal${savingsGoals.length === 1 ? "" : "s"}`}
          icon={<PiggyBank className="h-4 w-4" />}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lift lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="font-display">Recent activity</CardTitle>
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
                  const title = e.transaction.description ?? txnLabel(e.transaction.type);
                  return (
                    <li key={e.id} className="flex items-center gap-3 py-3 transition-colors hover:bg-muted/30 -mx-2 px-2 rounded-xl">
                      <span
                        className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ring-1 ring-white/10 ${
                          inflow ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {inflow ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{title}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {e.account.name} · {format(e.createdAt, "MMM d, HH:mm")}
                        </div>
                      </div>
                      <MoneyText amount={signed} currency={e.currency} signed colored className="text-sm font-semibold" />
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="ring-glow lift flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-gradient text-white shadow-glow">
                <Sparkles className="h-4 w-4" />
              </span>
              AI insight
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col justify-between gap-4">
            <p className="text-sm leading-relaxed text-foreground/90">
              {insightText ?? "Spend a little and your personalized insights will appear here."}
            </p>
            <p className="text-[11px] leading-snug text-muted-foreground">
              AI-generated for guidance only in this sandbox. Not financial advice.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold tracking-tight">Your accounts</h2>
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
                  <Card className="ring-glow lift h-full p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="grid h-10 w-10 place-items-center rounded-xl bg-muted text-lg">
                          {CURRENCY_FLAG[acc.currency]}
                        </span>
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
                    <div className="mt-4 font-display text-2xl font-semibold tracking-tight">
                      <MoneyText amount={acc.balanceCached} currency={acc.currency} withSymbol />
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Available <MoneyText amount={available} currency={acc.currency} withSymbol />
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
