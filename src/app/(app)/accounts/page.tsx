import Link from "next/link";
import { ChevronRight, Wallet, Plus } from "lucide-react";
import { Currency, AccountStatus } from "@prisma/client";
import { requirePageUser } from "@/lib/page-auth";
import { prisma } from "@/lib/db";
import { CURRENCY_META } from "@/lib/money";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/brand/page-header";
import { MoneyText } from "@/components/brand/money-text";
import { EmptyState } from "@/components/brand/states";

const CURRENCY_FLAG: Record<Currency, string> = { KGS: "🇰🇬", USD: "🇺🇸", EUR: "🇪🇺" };

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Accounts"
        description="All your balances across currencies, in one place."
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
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {accounts.map((acc) => {
            const available = acc.balanceCached - acc.holdTotal;
            const meta = CURRENCY_META[acc.currency];
            return (
              <Link key={acc.id} href={`/accounts/${acc.id}`} className="group block">
                <Card className="relative h-full overflow-hidden p-6 transition-all hover:border-primary/40 hover:shadow-glow">
                  {/* subtle currency tint */}
                  <div className="bg-radial-glow pointer-events-none absolute inset-0 opacity-60" />
                  <div className="relative space-y-5">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-xl">
                          {CURRENCY_FLAG[acc.currency]}
                        </span>
                        <div>
                          <div className="font-medium leading-tight">{acc.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {meta.label} · ••{acc.displayNumber}
                          </div>
                        </div>
                      </div>
                      <Badge variant={statusVariant(acc.status)}>{acc.status.toLowerCase()}</Badge>
                    </div>

                    <div>
                      <div className="text-3xl font-semibold tracking-tight tabular-nums">
                        <MoneyText amount={acc.balanceCached} currency={acc.currency} withSymbol />
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                        <span>Available</span>
                        <MoneyText amount={available} currency={acc.currency} withSymbol />
                        {acc.holdTotal > 0n && (
                          <span className="text-xs">
                            ·{" "}
                            <MoneyText amount={acc.holdTotal} currency={acc.currency} withSymbol /> on
                            hold
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-border/60 pt-4 text-sm font-medium text-primary">
                      <span>View transactions</span>
                      <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
