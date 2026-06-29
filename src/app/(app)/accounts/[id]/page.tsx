import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Wallet } from "lucide-react";
import { LedgerDirection, AccountStatus, Currency } from "@prisma/client";
import { requirePageUser } from "@/lib/page-auth";
import { prisma } from "@/lib/db";
import { CURRENCY_META } from "@/lib/money";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoneyText } from "@/components/brand/money-text";
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
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2 text-muted-foreground">
          <Link href="/accounts">
            <ArrowLeft className="h-4 w-4" /> Accounts
          </Link>
        </Button>
      </div>

      {/* Header / balance hero */}
      <Card className="premium-surface relative overflow-hidden border-white/10 p-0 text-white">
        <div className="bg-radial-glow p-6 md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-2xl">
                {CURRENCY_FLAG[account.currency]}
              </span>
              <div>
                <div className="text-lg font-semibold leading-tight">{account.name}</div>
                <div className="text-sm text-white/70">
                  {meta.label} · ••{account.displayNumber}
                </div>
              </div>
            </div>
            <Badge variant={statusVariant(account.status)}>{account.status.toLowerCase()}</Badge>
          </div>

          <div className="mt-6">
            <div className="text-sm text-white/70">Current balance</div>
            <div className="mt-1 text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl">
              <MoneyText amount={account.balanceCached} currency={account.currency} withSymbol />
            </div>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-white/80">
              <span className="inline-flex items-center gap-1.5">
                <Wallet className="h-4 w-4" /> Available{" "}
                <MoneyText amount={available} currency={account.currency} withSymbol />
              </span>
              {account.holdTotal > 0n && (
                <span>
                  On hold{" "}
                  <MoneyText amount={account.holdTotal} currency={account.currency} withSymbol />
                </span>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Transactions */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Transactions</h2>
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
