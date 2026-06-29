import {
  Settings as SettingsIcon,
  Database,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  FlaskConical,
  ArrowLeftRight,
  Receipt,
  Activity,
  ShieldCheck,
} from "lucide-react";
import { requirePageAdmin } from "@/lib/page-auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/brand/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MoneyText } from "@/components/brand/money-text";
import { EmptyState } from "@/components/brand/states";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Currency, LedgerDirection } from "@prisma/client";

/** Format a scaled FX rate (rateScaled / scale) to a readable decimal string. */
function formatRate(rateScaled: bigint, scale: number): string {
  if (scale <= 0) return rateScaled.toString();
  const scaleBig = BigInt(scale);
  const whole = rateScaled / scaleBig;
  const frac = rateScaled % scaleBig;
  const decimals = String(scale).length - 1;
  const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
  return fracStr ? `${whole}.${fracStr}` : whole.toString();
}

export default async function AdminSettingsPage() {
  await requirePageAdmin();

  const [fxRates, feeRules, accountCount, txCount, ledgerEntryCount, netByCurrency] =
    await Promise.all([
      prisma.fxRate.findMany({ orderBy: [{ baseCurrency: "asc" }, { quoteCurrency: "asc" }, { asOf: "desc" }] }),
      prisma.feeRule.findMany({ orderBy: { key: "asc" } }),
      prisma.account.count({ where: { deletedAt: null } }),
      prisma.transaction.count(),
      prisma.ledgerEntry.count(),
      prisma.ledgerEntry.groupBy({ by: ["currency", "direction"], _sum: { amount: true } }),
    ]);

  // Ledger integrity: per-currency net of debits vs credits must be zero.
  const netMap = new Map<Currency, bigint>();
  for (const row of netByCurrency) {
    const sum = row._sum.amount ?? 0n;
    const signed = row.direction === LedgerDirection.DEBIT ? sum : -sum;
    netMap.set(row.currency, (netMap.get(row.currency) ?? 0n) + signed);
  }
  const integrity = [...netMap.entries()].map(([currency, net]) => ({
    currency,
    balanced: net === 0n,
    net: net.toString(),
  }));
  const ledgerBalanced = integrity.every((i) => i.balanced);

  // Latest rate per base/quote pair.
  const seen = new Set<string>();
  const latestRates = fxRates.filter((r) => {
    const k = `${r.baseCurrency}/${r.quoteCurrency}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title={
          <>
            System <span className="text-gradient">settings</span>
          </>
        }
        description="Sandbox configuration, pricing, FX rates and ledger health. Read-only where backed by seeds."
        actions={
          <span className="inline-flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/10 px-3 py-1.5 text-sm font-medium text-warning backdrop-blur">
            <FlaskConical className="h-4 w-4" />
            Sandbox
          </span>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Environment toggles (mock) */}
        <Card className="glass-card lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-brand-violet/30 to-brand-violet/5 text-brand-violet ring-1 ring-white/10">
                <SettingsIcon className="h-4 w-4" />
              </span>
              Environment
            </CardTitle>
            <CardDescription>Runtime flags for this sandbox deployment.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ToggleRow
              label="Sandbox mode"
              detail="All money is play money on an internal ledger. No real settlement."
              on
            />
            <ToggleRow
              label="AI provider"
              detail="Mock provider — deterministic, grounded responses. No external LLM calls."
              valueBadge={
                <Badge variant="default" className="gap-1">
                  <Sparkles className="h-3 w-3" /> mock
                </Badge>
              }
            />
            <ToggleRow
              label="Real PANs / IBANs"
              detail="Never stored. Cards expose last-4 + a token reference only."
              off
            />
            <ToggleRow
              label="Audit hash-chaining"
              detail="Every privileged action is recorded in a tamper-evident chain."
              on
            />
          </CardContent>
        </Card>

        {/* System health */}
        <Card className="glass-card ring-glow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-brand-emerald/30 to-brand-emerald/5 text-brand-emerald ring-1 ring-white/10">
                <Activity className="h-4 w-4" />
              </span>
              System health
            </CardTitle>
            <CardDescription>Sandbox infrastructure status.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <HealthRow icon={<Database className="h-4 w-4" />} label="Database" ok detail="Connected" />
            <HealthRow
              icon={<ShieldCheck className="h-4 w-4" />}
              label="Ledger integrity"
              ok={ledgerBalanced}
              detail={ledgerBalanced ? "Double-entry balanced" : "Imbalance detected"}
            />
            <HealthRow
              icon={<Sparkles className="h-4 w-4" />}
              label="AI engine"
              ok
              detail="Mock · online"
            />
            <div className="grid grid-cols-3 gap-2 pt-1">
              <Metric label="Accounts" value={accountCount.toLocaleString()} />
              <Metric label="Txns" value={txCount.toLocaleString()} />
              <Metric label="Entries" value={ledgerEntryCount.toLocaleString()} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ledger integrity by currency */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {ledgerBalanced ? (
              <CheckCircle2 className="h-5 w-5 text-success" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-destructive" />
            )}
            Ledger integrity
          </CardTitle>
          <CardDescription>
            Per-currency net of debits minus credits. A balanced ledger nets to zero in every
            currency.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {integrity.length === 0 ? (
            <EmptyState title="No ledger entries" description="The ledger is empty." />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {integrity.map((i) => (
                <div
                  key={i.currency}
                  className={`flex items-center justify-between rounded-xl border p-4 ${
                    i.balanced ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5"
                  }`}
                >
                  <div>
                    <div className="text-sm font-medium">{i.currency}</div>
                    <div className="text-xs text-muted-foreground">
                      net <MoneyText amount={i.net} currency={i.currency} />
                    </div>
                  </div>
                  <Badge variant={i.balanced ? "success" : "destructive"}>
                    {i.balanced ? "Balanced" : "Imbalance"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* FX rates */}
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5 text-primary" /> FX rates
          </CardTitle>
          <CardDescription>
            Sandbox conversion rates with applied spread. Rates are integer-scaled on the wire.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {latestRates.length === 0 ? (
            <div className="px-6 pb-6">
              <EmptyState title="No FX rates" description="No rates have been seeded." />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pair</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Spread</TableHead>
                  <TableHead className="hidden md:table-cell">Source</TableHead>
                  <TableHead className="hidden md:table-cell text-right">As of</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {latestRates.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      {r.baseCurrency} → {r.quoteCurrency}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {formatRate(r.rateScaled, r.scale)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {(r.spreadBps / 100).toFixed(2)}%
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                      {r.source}
                    </TableCell>
                    <TableCell className="hidden text-right text-xs text-muted-foreground md:table-cell">
                      {new Intl.DateTimeFormat("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      }).format(r.asOf)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Fee rules */}
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" /> Fee rules
          </CardTitle>
          <CardDescription>
            Fee = flat amount + (amount × bps ÷ 10,000), in minor units.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {feeRules.length === 0 ? (
            <div className="px-6 pb-6">
              <EmptyState title="No fee rules" description="No fee rules have been seeded." />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Key</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Flat</TableHead>
                  <TableHead className="text-right">Bps</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {feeRules.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell>
                      <code className="text-xs">{f.key}</code>
                      <span className="block text-xs text-muted-foreground">{f.description}</span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {f.type.replaceAll("_", " ")}
                    </TableCell>
                    <TableCell className="text-right">
                      {f.flatAmount === 0n ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <MoneyText amount={f.flatAmount} currency={f.currency ?? "USD"} />
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{f.bps}</TableCell>
                    <TableCell>
                      <Badge variant={f.active ? "success" : "secondary"}>
                        {f.active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ToggleRow({
  label,
  detail,
  on,
  off,
  valueBadge,
}: {
  label: string;
  detail: string;
  on?: boolean;
  off?: boolean;
  valueBadge?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{detail}</div>
      </div>
      <div className="shrink-0">
        {valueBadge ? (
          valueBadge
        ) : on ? (
          <Badge variant="success">On</Badge>
        ) : off ? (
          <Badge variant="secondary">Off</Badge>
        ) : null}
      </div>
    </div>
  );
}

function HealthRow({
  icon,
  label,
  ok,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  ok: boolean;
  detail: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
      <div className="flex items-center gap-2.5">
        <span className={ok ? "text-success" : "text-destructive"}>{icon}</span>
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">{detail}</span>
        <span className={`h-2 w-2 rounded-full ${ok ? "bg-success shadow-glow" : "bg-destructive"}`} />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/30 p-2.5 text-center">
      <div className="text-base font-semibold tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}
