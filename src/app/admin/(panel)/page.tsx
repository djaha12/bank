import Link from "next/link";
import {
  Users,
  ShieldAlert,
  Siren,
  Wallet,
  Activity,
  Database,
  CheckCircle2,
  ArrowUpRight,
  FileCheck2,
  TrendingUp,
} from "lucide-react";
import { requirePageAdmin } from "@/lib/page-auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/brand/page-header";
import { StatCard } from "@/components/brand/stat-card";
import { MoneyText } from "@/components/brand/money-text";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/brand/states";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertStatus,
  Currency,
  KycStatus,
  LedgerDirection,
  RiskLevel,
  UserStatus,
} from "@prisma/client";

type BadgeVariant = "default" | "secondary" | "success" | "warning" | "destructive" | "outline";

function kycVariant(status: KycStatus): BadgeVariant {
  switch (status) {
    case KycStatus.APPROVED:
      return "success";
    case KycStatus.REJECTED:
      return "destructive";
    case KycStatus.IN_REVIEW:
    case KycStatus.PENDING:
      return "warning";
    default:
      return "secondary";
  }
}

function riskVariant(level: RiskLevel): BadgeVariant {
  switch (level) {
    case RiskLevel.LOW:
      return "success";
    case RiskLevel.MEDIUM:
      return "warning";
    case RiskLevel.HIGH:
    case RiskLevel.CRITICAL:
      return "destructive";
    default:
      return "secondary";
  }
}

function fmtDate(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function fmtRelative(d: Date): string {
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default async function AdminDashboardPage() {
  await requirePageAdmin();

  const [
    totalCustomers,
    activeCustomers,
    pendingKyc,
    inReviewKyc,
    openAlerts,
    criticalAlerts,
    approvedCustomers,
    ledgerByCurrency,
    recentAlerts,
    kycQueue,
    accountCount,
    ledgerEntryCount,
    txTotal,
  ] = await Promise.all([
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.user.count({ where: { deletedAt: null, status: UserStatus.ACTIVE } }),
    prisma.kycApplication.count({ where: { status: KycStatus.PENDING } }),
    prisma.kycApplication.count({ where: { status: KycStatus.IN_REVIEW } }),
    prisma.amlAlert.count({ where: { status: AlertStatus.OPEN } }),
    prisma.amlAlert.count({
      where: { status: AlertStatus.OPEN, level: { in: [RiskLevel.HIGH, RiskLevel.CRITICAL] } },
    }),
    prisma.user.count({ where: { deletedAt: null, kycStatus: KycStatus.APPROVED } }),
    prisma.ledgerEntry.groupBy({
      by: ["currency"],
      where: { direction: LedgerDirection.DEBIT },
      _sum: { amount: true },
    }),
    prisma.amlAlert.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      include: {
        user: { select: { email: true, profile: { select: { firstName: true, lastName: true } } } },
      },
    }),
    prisma.kycApplication.findMany({
      where: { status: { in: [KycStatus.PENDING, KycStatus.IN_REVIEW] } },
      orderBy: { submittedAt: "asc" },
      take: 6,
      include: {
        user: { select: { email: true, profile: { select: { firstName: true, lastName: true } } } },
      },
    }),
    prisma.account.count({ where: { deletedAt: null } }),
    prisma.ledgerEntry.count(),
    prisma.transaction.count(),
  ]);

  // Ledger volume = total debits across currencies, kept per-currency since we
  // cannot sum across currencies. Volume is the truth of money moved.
  const volumeByCurrency = ledgerByCurrency
    .map((g) => ({ currency: g.currency, amount: g._sum.amount ?? 0n }))
    .sort((a, b) => (b.amount > a.amount ? 1 : -1));
  const primaryVolume = volumeByCurrency.length > 0 ? volumeByCurrency[0] : undefined;

  // Ledger integrity check: net of debits vs credits per currency must be zero.
  const netByCurrency = await prisma.ledgerEntry.groupBy({
    by: ["currency", "direction"],
    _sum: { amount: true },
  });
  const netMap = new Map<Currency, bigint>();
  for (const row of netByCurrency) {
    const sum = row._sum.amount ?? 0n;
    const signed = row.direction === LedgerDirection.DEBIT ? sum : -sum;
    netMap.set(row.currency, (netMap.get(row.currency) ?? 0n) + signed);
  }
  const ledgerBalanced = [...netMap.values()].every((v) => v === 0n);

  const kycCoverage =
    totalCustomers > 0 ? Math.round((approvedCustomers / totalCustomers) * 100) : 0;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Compliance Operations"
        description="Live overview of customers, identity verification, financial-crime alerts and ledger health."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/aml">
              <Siren className="h-4 w-4" /> AML queue
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total customers"
          value={totalCustomers.toLocaleString()}
          hint={`${activeCustomers.toLocaleString()} active`}
          icon={<Users className="h-4 w-4 text-primary" />}
        />
        <StatCard
          label="Pending KYC"
          value={(pendingKyc + inReviewKyc).toLocaleString()}
          hint={`${pendingKyc} new · ${inReviewKyc} in review`}
          icon={<FileCheck2 className="h-4 w-4 text-warning" />}
        />
        <StatCard
          label="Open AML alerts"
          value={openAlerts.toLocaleString()}
          hint={`${criticalAlerts} high / critical`}
          icon={<Siren className="h-4 w-4 text-destructive" />}
        />
        <StatCard
          premium
          label="Ledger volume"
          value={
            primaryVolume ? (
              <MoneyText amount={primaryVolume.amount} currency={primaryVolume.currency} />
            ) : (
              "0"
            )
          }
          hint={
            volumeByCurrency.length > 1
              ? `+${volumeByCurrency.length - 1} more currencies`
              : "across the ledger"
          }
          icon={<Wallet className="h-4 w-4 text-white" />}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Compliance overview */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Compliance overview</CardTitle>
                <CardDescription>KYC coverage and risk posture across the book.</CardDescription>
              </div>
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">KYC coverage</span>
                <span className="font-medium tabular-nums">{kycCoverage}%</span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-brand-gradient"
                  style={{ width: `${kycCoverage}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {approvedCustomers.toLocaleString()} of {totalCustomers.toLocaleString()} customers
                fully verified.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { label: "Approved", value: approvedCustomers, tone: "text-success" },
                { label: "Awaiting review", value: pendingKyc + inReviewKyc, tone: "text-warning" },
                { label: "Open alerts", value: openAlerts, tone: "text-destructive" },
                { label: "Critical", value: criticalAlerts, tone: "text-destructive" },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border border-border/60 bg-muted/30 p-4">
                  <div className={`text-2xl font-semibold tabular-nums ${s.tone}`}>
                    {s.value.toLocaleString()}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{s.label}</div>
                </div>
              ))}
            </div>

            {volumeByCurrency.length > 0 && (
              <div className="space-y-2 rounded-xl border border-border/60 p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Ledger volume by currency
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {volumeByCurrency.map((v) => (
                    <div
                      key={v.currency}
                      className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2"
                    >
                      <span className="text-sm text-muted-foreground">{v.currency}</span>
                      <MoneyText
                        amount={v.amount}
                        currency={v.currency}
                        className="text-sm font-medium"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* System health */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>System health</CardTitle>
                <CardDescription>Sandbox infrastructure status.</CardDescription>
              </div>
              <Activity className="h-5 w-5 text-success" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <HealthRow
              icon={<Database className="h-4 w-4" />}
              label="Database"
              ok
              detail="Connected"
            />
            <HealthRow
              icon={<CheckCircle2 className="h-4 w-4" />}
              label="Ledger integrity"
              ok={ledgerBalanced}
              detail={ledgerBalanced ? "Double-entry balanced" : "Imbalance detected"}
            />
            <HealthRow
              icon={<ShieldAlert className="h-4 w-4" />}
              label="AML engine"
              ok={criticalAlerts === 0}
              detail={
                criticalAlerts === 0
                  ? "No critical alerts"
                  : `${criticalAlerts} critical open`
              }
            />
            <div className="grid grid-cols-3 gap-2 pt-2">
              <Metric label="Accounts" value={accountCount.toLocaleString()} />
              <Metric label="Txns" value={txTotal.toLocaleString()} />
              <Metric label="Entries" value={ledgerEntryCount.toLocaleString()} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent AML alerts */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent AML alerts</CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link href="/admin/aml">
                  View all <ArrowUpRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-0 pb-2">
            {recentAlerts.length === 0 ? (
              <div className="px-6 pb-4">
                <EmptyState title="No alerts" description="No AML alerts have been raised yet." />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Rule</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead className="text-right">Raised</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentAlerts.map((a) => {
                    const name = a.user.profile
                      ? `${a.user.profile.firstName} ${a.user.profile.lastName}`
                      : a.user.email;
                    return (
                      <TableRow key={a.id}>
                        <TableCell>
                          <Link
                            href={`/admin/customers/${a.userId}`}
                            className="font-medium hover:text-primary"
                          >
                            {name}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">
                            {a.ruleCode.replaceAll("_", " ")}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={riskVariant(a.level)}>{a.level}</Badge>
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          {fmtRelative(a.createdAt)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* KYC queue */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>KYC review queue</CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link href="/admin/kyc">
                  View all <ArrowUpRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-0 pb-2">
            {kycQueue.length === 0 ? (
              <div className="px-6 pb-4">
                <EmptyState
                  title="Queue clear"
                  description="No applications awaiting review."
                  icon={<CheckCircle2 className="h-6 w-6" />}
                />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Applicant</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Submitted</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {kycQueue.map((k) => {
                    const name = k.user.profile
                      ? `${k.user.profile.firstName} ${k.user.profile.lastName}`
                      : k.user.email;
                    return (
                      <TableRow key={k.id}>
                        <TableCell>
                          <Link href="/admin/kyc" className="font-medium hover:text-primary">
                            {name}
                          </Link>
                          <div className="text-xs text-muted-foreground">{k.user.email}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={kycVariant(k.status)}>
                            {k.status.replaceAll("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          {k.submittedAt ? fmtDate(k.submittedAt) : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
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
        <span
          className={`h-2 w-2 rounded-full ${ok ? "bg-success shadow-glow" : "bg-destructive"}`}
        />
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
