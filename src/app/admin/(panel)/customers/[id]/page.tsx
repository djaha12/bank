import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  CalendarDays,
  Briefcase,
  Wallet,
  CreditCard,
  ShieldCheck,
  GaugeCircle,
  Siren,
  ReceiptText,
  Globe,
  Hash,
} from "lucide-react";
import { requirePageAdmin } from "@/lib/page-auth";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { StatCard } from "@/components/brand/stat-card";
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
import {
  AccountStatus,
  CardStatus,
  Currency,
  KycStatus,
  RiskLevel,
  UserStatus,
} from "@prisma/client";
import { CustomerActionsClient } from "./CustomerActionsClient";

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

function userStatusVariant(status: UserStatus): BadgeVariant {
  switch (status) {
    case UserStatus.ACTIVE:
      return "success";
    case UserStatus.SUSPENDED:
      return "warning";
    case UserStatus.BLOCKED:
    case UserStatus.CLOSED:
      return "destructive";
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

const RISK_ACCENT: Record<RiskLevel, "violet" | "cyan" | "emerald" | "blue"> = {
  LOW: "emerald",
  MEDIUM: "cyan",
  HIGH: "violet",
  CRITICAL: "violet",
};

function accountStatusVariant(status: AccountStatus): BadgeVariant {
  switch (status) {
    case AccountStatus.ACTIVE:
      return "success";
    case AccountStatus.FROZEN:
      return "warning";
    default:
      return "destructive";
  }
}

function cardStatusVariant(status: CardStatus): BadgeVariant {
  switch (status) {
    case CardStatus.ACTIVE:
      return "success";
    case CardStatus.FROZEN:
      return "warning";
    default:
      return "destructive";
  }
}

function fmtDate(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

function fmtDateTime(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageAdmin();
  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      profile: true,
      accounts: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } },
      cards: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
      kycApplications: { orderBy: { createdAt: "desc" }, take: 1 },
      riskScores: { where: { current: true }, take: 1 },
      amlAlerts: { orderBy: { createdAt: "desc" }, take: 8 },
      transactions: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });

  if (!user || user.deletedAt) notFound();

  const profile = user.profile;
  const latestKyc = user.kycApplications.length > 0 ? user.kycApplications[0] : null;
  const risk = user.riskScores.length > 0 ? user.riskScores[0] : null;
  const displayName = profile
    ? `${profile.firstName} ${profile.lastName}`.trim()
    : user.email;

  // Per-currency balance totals across this customer's accounts (cannot sum
  // across currencies — surface the largest pot as the headline figure).
  const totalsByCurrency = new Map<Currency, bigint>();
  for (const a of user.accounts) {
    totalsByCurrency.set(
      a.currency,
      (totalsByCurrency.get(a.currency) ?? 0n) + a.balanceCached,
    );
  }
  const sortedTotals = [...totalsByCurrency.entries()].sort((a, b) =>
    b[1] > a[1] ? 1 : -1,
  );
  const headlineTotal = sortedTotals.length > 0 ? sortedTotals[0] : undefined;
  const openAlerts = user.amlAlerts.filter((a) => a.status !== "CLOSED").length;
  const activeCards = user.cards.filter((c) => c.status === CardStatus.ACTIVE).length;

  return (
    <div className="space-y-8">
      <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
        <Link href="/admin/customers">
          <ArrowLeft className="h-4 w-4" /> Back to customers
        </Link>
      </Button>

      {/* Profile hero */}
      <section className="premium-surface ring-glow relative flex flex-col gap-5 p-6 text-white sm:flex-row sm:items-center sm:justify-between md:p-8">
        <div className="relative z-10 flex items-center gap-4">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-xl font-semibold text-white shadow-glow ring-1 ring-white/20 backdrop-blur">
            {(profile?.firstName?.[0] ?? user.email[0] ?? "?").toUpperCase()}
            {(profile?.lastName?.[0] ?? "").toUpperCase()}
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
                {displayName}
              </h1>
              <Badge variant={userStatusVariant(user.status)}>{user.status}</Badge>
            </div>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-white/70">
              <Mail className="h-3.5 w-3.5" /> {user.email}
            </p>
            <p className="mt-1 flex items-center gap-1.5 font-mono text-[11px] text-white/50">
              <Hash className="h-3 w-3" /> {user.id}
            </p>
          </div>
        </div>
        <div className="relative z-10">
          <CustomerActionsClient
            customerId={user.id}
            customerName={displayName}
            status={user.status}
          />
        </div>
      </section>

      {/* Snapshot stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          accent="violet"
          index={0}
          label="Total balance"
          value={
            headlineTotal ? (
              <MoneyText amount={headlineTotal[1]} currency={headlineTotal[0]} withSymbol />
            ) : (
              "—"
            )
          }
          hint={
            sortedTotals.length > 1
              ? `${headlineTotal?.[0]} · +${sortedTotals.length - 1} more`
              : (headlineTotal?.[0] ?? "no accounts")
          }
          icon={<Wallet className="h-4 w-4" />}
        />
        <StatCard
          accent="blue"
          index={1}
          label="Cards"
          value={user.cards.length.toLocaleString()}
          hint={`${activeCards} active`}
          icon={<CreditCard className="h-4 w-4" />}
        />
        <StatCard
          accent={risk ? RISK_ACCENT[risk.level] : "cyan"}
          index={2}
          label="Risk score"
          value={risk ? risk.score.toString() : "—"}
          hint={risk ? risk.level : "no score"}
          icon={<GaugeCircle className="h-4 w-4" />}
        />
        <StatCard
          accent="violet"
          index={3}
          label="AML alerts"
          value={user.amlAlerts.length.toLocaleString()}
          hint={`${openAlerts} open`}
          icon={<Siren className="h-4 w-4" />}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Identity */}
        <Card className="glass-card lift lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-lg">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-brand-blue/30 to-brand-blue/5 text-brand-blue ring-1 ring-white/10">
                <ShieldCheck className="h-4 w-4" />
              </span>
              Identity
            </CardTitle>
            <CardDescription>Profile and contact details on file.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
              <Field icon={<Mail className="h-4 w-4" />} label="Email" value={user.email} />
              <Field icon={<Phone className="h-4 w-4" />} label="Phone" value={profile?.phone ?? "—"} />
              <Field
                icon={<CalendarDays className="h-4 w-4" />}
                label="Date of birth"
                value={profile?.dateOfBirth ? fmtDate(profile.dateOfBirth) : "—"}
              />
              <Field
                icon={<Globe className="h-4 w-4" />}
                label="Nationality"
                value={profile?.nationality ?? "—"}
              />
              <Field
                icon={<MapPin className="h-4 w-4" />}
                label="Residence"
                value={
                  [profile?.city, profile?.country].filter(Boolean).join(", ") || "—"
                }
              />
              <Field
                icon={<Briefcase className="h-4 w-4" />}
                label="Occupation"
                value={profile?.occupation ?? "—"}
              />
              <Field
                icon={<CalendarDays className="h-4 w-4" />}
                label="Customer since"
                value={fmtDate(user.createdAt)}
              />
              <Field
                icon={<ShieldCheck className="h-4 w-4" />}
                label="Email verified"
                value={user.emailVerified ? "Yes" : "No"}
              />
            </dl>
            {profile?.addressLine1 && (
              <>
                <Separator className="my-4" />
                <div className="text-sm">
                  <span className="text-muted-foreground">Address</span>
                  <p className="mt-1">
                    {[
                      profile.addressLine1,
                      profile.addressLine2,
                      profile.postalCode,
                      profile.city,
                      profile.country,
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Risk & KYC summary */}
        <div className="space-y-6">
          <Card className="glass-card ring-glow lift">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="font-display text-lg">Risk score</CardTitle>
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-brand-violet/30 to-brand-violet/5 text-brand-violet ring-1 ring-white/10">
                  <GaugeCircle className="h-4 w-4" />
                </span>
              </div>
            </CardHeader>
            <CardContent>
              {risk ? (
                <div className="space-y-3">
                  <div className="flex items-end justify-between">
                    <span className="font-display text-5xl font-semibold tabular-nums tracking-tight">
                      {risk.score}
                    </span>
                    <Badge variant={riskVariant(risk.level)}>{risk.level}</Badge>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-brand-gradient"
                      style={{ width: `${Math.min(100, Math.max(0, risk.score))}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Updated {fmtDate(risk.createdAt)}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No risk score on record.</p>
              )}
            </CardContent>
          </Card>

          <Card className="glass-card lift">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="font-display text-lg">KYC</CardTitle>
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-brand-cyan/30 to-brand-cyan/5 text-brand-cyan ring-1 ring-white/10">
                  <ShieldCheck className="h-4 w-4" />
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Account status</span>
                <Badge variant={kycVariant(user.kycStatus)}>
                  {user.kycStatus.replaceAll("_", " ")}
                </Badge>
              </div>
              {latestKyc ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Application</span>
                    <Badge variant={kycVariant(latestKyc.status)}>
                      {latestKyc.status.replaceAll("_", " ")}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Submitted</span>
                    <span>{latestKyc.submittedAt ? fmtDate(latestKyc.submittedAt) : "—"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">PEP declared</span>
                    <span>{latestKyc.declaredPepStatus ? "Yes" : "No"}</span>
                  </div>
                  {latestKyc.sourceOfFunds && (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Source of funds</span>
                      <span className="truncate text-right">{latestKyc.sourceOfFunds}</span>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground">No KYC application submitted.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Accounts */}
      <Card className="glass-card lift">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-lg">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-brand-emerald/30 to-brand-emerald/5 text-brand-emerald ring-1 ring-white/10">
              <Wallet className="h-4 w-4" />
            </span>
            Accounts
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-2">
          {user.accounts.length === 0 ? (
            <div className="px-6 pb-4">
              <EmptyState title="No accounts" description="No accounts provisioned for this customer." />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead>Currency</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Available</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {user.accounts.map((a) => (
                  <TableRow key={a.id} className="transition-colors hover:bg-muted/40">
                    <TableCell>
                      <div className="font-medium">{a.name}</div>
                      <div className="font-mono text-xs text-muted-foreground">
                        {a.type} · ••{a.displayNumber}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {a.currency}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={accountStatusVariant(a.status)}>{a.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <MoneyText
                        amount={a.balanceCached - a.holdTotal}
                        currency={a.currency}
                        className="text-sm text-muted-foreground"
                      />
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      <MoneyText amount={a.balanceCached} currency={a.currency} withSymbol />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Cards */}
        <Card className="glass-card lift">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-lg">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-brand-blue/30 to-brand-blue/5 text-brand-blue ring-1 ring-white/10">
                <CreditCard className="h-4 w-4" />
              </span>
              Cards
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {user.cards.length === 0 ? (
              <EmptyState title="No cards" description="No cards issued." />
            ) : (
              user.cards.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 p-3 transition-colors hover:border-border hover:bg-muted/40"
                >
                  <div>
                    <div className="font-mono font-medium tabular-nums">
                      {c.brand} •••• {c.last4}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {c.cardholderName} · exp {String(c.expMonth).padStart(2, "0")}/
                      {String(c.expYear).slice(-2)}
                    </div>
                  </div>
                  <Badge variant={cardStatusVariant(c.status)}>{c.status}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* AML alerts */}
        <Card className="glass-card lift">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-lg">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-brand-violet/30 to-brand-violet/5 text-brand-violet ring-1 ring-white/10">
                <Siren className="h-4 w-4" />
              </span>
              AML alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {user.amlAlerts.length === 0 ? (
              <EmptyState title="No alerts" description="No AML alerts raised for this customer." />
            ) : (
              user.amlAlerts.map((al) => (
                <div
                  key={al.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 p-3 transition-colors hover:border-border hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-medium">
                        {al.ruleCode.replaceAll("_", " ")}
                      </span>
                      <Badge variant={riskVariant(al.level)}>{al.level}</Badge>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{al.reason}</p>
                  </div>
                  <Badge
                    variant={al.status === "CLOSED" ? "secondary" : "warning"}
                    className="shrink-0"
                  >
                    {al.status}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent transactions */}
      <Card className="glass-card lift">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-lg">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-brand-cyan/30 to-brand-cyan/5 text-brand-cyan ring-1 ring-white/10">
              <ReceiptText className="h-4 w-4" />
            </span>
            Recent transactions
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-2">
          {user.transactions.length === 0 ? (
            <div className="px-6 pb-4">
              <EmptyState title="No transactions" description="This customer has no transactions." />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {user.transactions.map((t) => (
                  <TableRow key={t.id} className="transition-colors hover:bg-muted/40">
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {fmtDateTime(t.createdAt)}
                    </TableCell>
                    <TableCell className="text-sm">{t.type.replaceAll("_", " ")}</TableCell>
                    <TableCell className="max-w-[16rem] truncate text-sm">
                      {t.description ?? t.reference ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          t.status === "COMPLETED"
                            ? "success"
                            : t.status === "FAILED"
                              ? "destructive"
                              : t.status === "REVERSED"
                                ? "secondary"
                                : "warning"
                        }
                      >
                        {t.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      <MoneyText amount={t.amount} currency={t.currency} />
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

function Field({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="truncate text-sm font-medium">{value}</dd>
      </div>
    </div>
  );
}
