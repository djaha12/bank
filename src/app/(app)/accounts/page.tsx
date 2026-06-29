import Link from "next/link";
import { ArrowUpRight, Layers, Wallet, Plus, Lock } from "lucide-react";
import { Currency, AccountStatus } from "@prisma/client";
import { requirePageUser } from "@/lib/page-auth";
import { prisma } from "@/lib/db";
import { CURRENCY_META } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/brand/page-header";
import { MoneyText } from "@/components/brand/money-text";
import { AnimatedMoney } from "@/components/brand/animated-number";
import { EmptyState } from "@/components/brand/states";

const PRIMARY: Currency = "KGS";
const CURRENCY_FLAG: Record<Currency, string> = { KGS: "🇰🇬", USD: "🇺🇸", EUR: "🇪🇺" };

// Accent ramp cycled across the account cards for a duotone, premium feel.
const ACCENTS = [
  "from-brand-violet/25 via-brand-violet/5",
  "from-brand-cyan/25 via-brand-cyan/5",
  "from-brand-emerald/25 via-brand-emerald/5",
  "from-brand-blue/25 via-brand-blue/5",
] as const;

function statusVariant(status: AccountStatus): "success" | "warning" | "destructive" {
  if (status === "ACTIVE") return "success";
  if (status === "FROZEN") return "warning";
  return "destructive";
}

export default async function AccountsPage() {
  const user = await requirePageUser();

  const accounts = await prisma.account.findMany({
    where: { userId: user.id, deletedAt: null, ownerType: "USER" },
    orderBy: [{ currency: "asc" }, { createdAt: "asc" }],
  });

  // Per-currency totals for the portfolio hero.
  const totalsByCurrency = new Map<Currency, bigint>();
  for (const acc of accounts) {
    totalsByCurrency.set(acc.currency, (totalsByCurrency.get(acc.currency) ?? 0n) + acc.balanceCached);
  }
  const primaryTotal = totalsByCurrency.get(PRIMARY) ?? 0n;
  const otherTotals = [...totalsByCurrency.entries()].filter(([c]) => c !== PRIMARY);

  return (
    <div className="space-y-8">
      <PageHeader
        title={
          <>
            Your <span className="text-gradient">accounts</span>
          </>
        }
        description="Every balance, across every currency — one premium view."
        actions={
          <Button asChild variant="gradient" size="sm">
            <Link href="/transfers?deposit=1">
              <Plus className="h-4 w-4" /> Add money
            </Link>
          </Button>
        }
      />

      {accounts.length === 0 ? (
        <EmptyState
          title="No accounts yet"
          description="Your KGS, USD and EUR accounts will appear here once your profile is ready."
          icon={<Wallet className="h-6 w-6" />}
          action={
            <Button asChild variant="gradient" size="sm">
              <Link href="/transfers?deposit=1">
                <Plus className="h-4 w-4" /> Add money
              </Link>
            </Button>
          }
        />
      ) : (
        <>
          {/* Portfolio hero — premium summary across currencies */}
          <section className="premium-surface ring-glow shine relative grid gap-6 p-6 text-white md:grid-cols-[1.2fr_0.8fr] md:p-8">
            <div className="relative z-10 flex flex-col justify-between gap-6">
              <div>
                <div className="flex items-center gap-2 text-sm text-white/70">
                  <span className="dot text-brand-emerald" />
                  Primary balance · {CURRENCY_META[PRIMARY].label}
                </div>
                <AnimatedMoney
                  amount={primaryTotal.toString()}
                  currency={PRIMARY}
                  withSymbol
                  className="mt-3 block font-display text-4xl font-semibold leading-none tracking-tight sm:text-5xl"
                />
              </div>
              {otherTotals.length > 0 && (
                <div className="flex flex-wrap gap-2">
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
            </div>
            <div className="relative z-10 flex items-center justify-end gap-6 text-right md:flex-col md:items-end md:justify-center">
              <div>
                <div className="font-display text-3xl font-semibold tabular-nums">{accounts.length}</div>
                <div className="text-xs uppercase tracking-wider text-white/60">
                  {accounts.length === 1 ? "account" : "accounts"}
                </div>
              </div>
              <div>
                <div className="font-display text-3xl font-semibold tabular-nums">{totalsByCurrency.size}</div>
                <div className="text-xs uppercase tracking-wider text-white/60">
                  {totalsByCurrency.size === 1 ? "currency" : "currencies"}
                </div>
              </div>
            </div>
          </section>

          {/* Account cards */}
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {accounts.map((acc, i) => {
              const available = acc.balanceCached - acc.holdTotal;
              const meta = CURRENCY_META[acc.currency];
              const accent = ACCENTS[i % ACCENTS.length] ?? ACCENTS[0];
              return (
                <Link
                  key={acc.id}
                  href={`/accounts/${acc.id}`}
                  className="group block animate-fade-up"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <div className="glass-card ring-glow lift relative h-full overflow-hidden rounded-3xl p-6">
                    {/* duotone glow wash */}
                    <div
                      className={`pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-gradient-to-br ${accent} to-transparent opacity-70 blur-2xl transition-opacity duration-300 group-hover:opacity-100`}
                    />
                    <div className="relative space-y-5">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <span className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-muted/80 text-xl shadow-inner">
                            {CURRENCY_FLAG[acc.currency]}
                          </span>
                          <div>
                            <div className="font-medium leading-tight">{acc.name}</div>
                            <div className="text-xs text-muted-foreground">
                              ••{acc.displayNumber}
                            </div>
                          </div>
                        </div>
                        <Badge variant={statusVariant(acc.status)} className="gap-1">
                          {acc.status !== "ACTIVE" && <Lock className="h-3 w-3" />}
                          {acc.status.toLowerCase()}
                        </Badge>
                      </div>

                      <div>
                        <div className="mb-1.5 flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/40 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                            {meta.symbol} {acc.currency}
                          </span>
                        </div>
                        <div className="font-display text-3xl font-semibold tracking-tight tabular-nums">
                          <MoneyText amount={acc.balanceCached} currency={acc.currency} withSymbol />
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground">
                          <span>Available</span>
                          <MoneyText
                            amount={available}
                            currency={acc.currency}
                            withSymbol
                            className="font-medium text-foreground/80"
                          />
                          {acc.holdTotal > 0n && (
                            <span className="text-xs text-warning">
                              ·{" "}
                              <MoneyText amount={acc.holdTotal} currency={acc.currency} withSymbol /> on
                              hold
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between border-t border-border/60 pt-4 text-sm font-medium text-primary">
                        <span className="inline-flex items-center gap-1.5">
                          <Layers className="h-4 w-4" /> View transactions
                        </span>
                        <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
