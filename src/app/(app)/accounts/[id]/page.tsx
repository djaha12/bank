import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Wallet, Lock, ArrowDownLeft, ArrowUpRight, Hash } from "lucide-react";
import { LedgerDirection, AccountStatus, Currency } from "@prisma/client";
import { requirePageUser } from "@/lib/page-auth";
import { prisma } from "@/lib/db";
import { CURRENCY_META } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoneyText } from "@/components/brand/money-text";
import { AnimatedMoney } from "@/components/brand/animated-number";
import { AccountsClient, type AccountTxnRow } from "./AccountsClient";

const CURRENCY_FLAG: Record<Currency, string> = { KGS: "🇰🇬", USD: "🇺🇸", EUR: "🇪🇺" };

function statusVariant(status: AccountStatus): "success" | "warning" | "destructive" {
  if (status === "ACTIVE") return "success";
  if (status === "FROZEN") return "warning";
  return "destructive";
}

function txnLabel(type: string): string {
  return type
    .toLowerCase()
    .split("_")
    .map((w) => (w.length ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePageUser();
  const { id } = await params;

  const account = await prisma.account.findUnique({
    where: { id },
    include: {
      ledgerEntries: {
        orderBy: { createdAt: "desc" },
        take: 100,
        include: {
          transaction: { select: { type: true, description: true } },
        },
      },
    },
  });

  if (!account || account.userId !== user.id || account.deletedAt) {
    notFound();
  }

  const available = account.balanceCached - account.holdTotal;
  const meta = CURRENCY_META[account.currency];

  // Money in / out across the loaded window — presentation summary only.
  let moneyIn = 0n;
  let moneyOut = 0n;
  for (const e of account.ledgerEntries) {
    if (e.direction === LedgerDirection.CREDIT) moneyIn += e.amount;
    else moneyOut += e.amount;
  }

  const rows: AccountTxnRow[] = account.ledgerEntries.map((e) => {
    const inflow = e.direction === LedgerDirection.CREDIT;
    const signed = inflow ? e.amount : -e.amount;
    return {
      id: e.id,
      date: e.createdAt.toISOString(),
      type: e.transaction.type,
      typeLabel: txnLabel(e.transaction.type),
      direction: e.direction,
      signedAmount: signed.toString(),
      balanceAfter: e.balanceAfter.toString(),
      description: e.transaction.description,
    };
  });

  // Distinct types present, for the filter dropdown.
  const typeMap = new Map<string, string>();
  for (const r of rows) typeMap.set(r.type, r.typeLabel);
  const types = [...typeMap.entries()].map(([value, label]) => ({ value, label }));

  return (
    <div className="space-y-8">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-1 -ml-2 text-muted-foreground">
          <Link href="/accounts">
            <ArrowLeft className="h-4 w-4" /> Accounts
          </Link>
        </Button>
      </div>

      {/* Header / balance hero */}
      <section className="premium-surface ring-glow shine relative overflow-hidden p-6 text-white md:p-9">
        <div className="relative z-10">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/10 text-2xl backdrop-blur">
                {CURRENCY_FLAG[account.currency]}
              </span>
              <div>
                <div className="font-display text-lg font-semibold leading-tight">{account.name}</div>
                <div className="flex items-center gap-1.5 text-sm text-white/70">
                  <Hash className="h-3.5 w-3.5" />
                  {meta.label} · ••{account.displayNumber}
                </div>
              </div>
            </div>
            <Badge
              variant={statusVariant(account.status)}
              className="gap-1 border border-white/10 bg-white/10 text-white backdrop-blur"
            >
              {account.status !== "ACTIVE" && <Lock className="h-3 w-3" />}
              {account.status.toLowerCase()}
            </Badge>
          </div>

          <div className="mt-7">
            <div className="flex items-center gap-2 text-sm text-white/70">
              <span className="dot text-brand-emerald" />
              Current balance
            </div>
            <AnimatedMoney
              amount={account.balanceCached.toString()}
              currency={account.currency}
              withSymbol
              className="mt-2 block font-display text-4xl font-semibold leading-none tracking-tight sm:text-5xl"
            />
          </div>

          {/* Inline glass stat chips */}
          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
              <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-white/60">
                <Wallet className="h-3.5 w-3.5" /> Available
              </div>
              <div className="mt-1.5 font-display text-lg font-semibold tabular-nums">
                <MoneyText amount={available} currency={account.currency} withSymbol />
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
              <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-white/60">
                <Lock className="h-3.5 w-3.5" /> On hold
              </div>
              <div className="mt-1.5 font-display text-lg font-semibold tabular-nums">
                <MoneyText amount={account.holdTotal} currency={account.currency} withSymbol />
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
              <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-emerald-300/80">
                <ArrowDownLeft className="h-3.5 w-3.5" /> Money in
              </div>
              <div className="mt-1.5 font-display text-lg font-semibold tabular-nums text-emerald-300">
                <MoneyText amount={moneyIn} currency={account.currency} withSymbol />
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
              <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-white/60">
                <ArrowUpRight className="h-3.5 w-3.5" /> Money out
              </div>
              <div className="mt-1.5 font-display text-lg font-semibold tabular-nums">
                <MoneyText amount={moneyOut} currency={account.currency} withSymbol />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Transactions */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold tracking-tight">Transactions</h2>
          <span className="text-sm text-muted-foreground tabular-nums">
            {rows.length} {rows.length === 1 ? "entry" : "entries"}
          </span>
        </div>
        <AccountsClient
          accountId={account.id}
          currency={account.currency}
          rows={rows}
          types={types}
        />
      </div>
    </div>
  );
}
