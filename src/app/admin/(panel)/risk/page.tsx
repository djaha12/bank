import {
  GaugeCircle,
  Banknote,
  Layers,
  Globe,
  Store,
  Activity,
  Smartphone,
  LockKeyhole,
  TrendingUp,
  ShieldX,
  Users,
} from "lucide-react";
import { requirePageAdmin } from "@/lib/page-auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/brand/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/brand/states";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AmlRuleCode, RiskLevel } from "@prisma/client";

type BadgeVariant = "default" | "secondary" | "success" | "warning" | "destructive" | "outline";

const LEVEL_ORDER: RiskLevel[] = [
  RiskLevel.CRITICAL,
  RiskLevel.HIGH,
  RiskLevel.MEDIUM,
  RiskLevel.LOW,
];

function levelVariant(level: RiskLevel): BadgeVariant {
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

function scoreTone(score: number): string {
  if (score >= 75) return "text-destructive";
  if (score >= 50) return "text-warning";
  if (score >= 25) return "text-primary";
  return "text-success";
}

// Documentation for every rule in the AmlRuleCode enum (sandbox thresholds).
const RULE_DOCS: Record<
  AmlRuleCode,
  { icon: React.ReactNode; title: string; threshold: string; description: string; weight: BadgeVariant }
> = {
  LARGE_TRANSACTION: {
    icon: <Banknote className="h-4 w-4" />,
    title: "Large transaction",
    threshold: "Single movement ≥ 1,000,000 minor units",
    description:
      "A single transaction whose value exceeds the high-value threshold for the account currency.",
    weight: "destructive",
  },
  MANY_SMALL_TRANSFERS: {
    icon: <Layers className="h-4 w-4" />,
    title: "Many small transfers",
    threshold: "≥ 10 sub-threshold transfers within 24h",
    description:
      "Potential structuring: a burst of small transfers that individually stay below reporting limits.",
    weight: "warning",
  },
  HIGH_RISK_COUNTRY: {
    icon: <Globe className="h-4 w-4" />,
    title: "High-risk country",
    threshold: "Counterparty in a flagged jurisdiction",
    description:
      "Cross-border movement to or from a country on the sandbox high-risk / monitored list.",
    weight: "destructive",
  },
  UNUSUAL_MERCHANT: {
    icon: <Store className="h-4 w-4" />,
    title: "Unusual merchant",
    threshold: "MCC outside the customer's normal spend",
    description:
      "Card activity at a merchant category inconsistent with the customer's established behaviour.",
    weight: "warning",
  },
  VELOCITY: {
    icon: <Activity className="h-4 w-4" />,
    title: "Velocity",
    threshold: "> 20 transactions per hour",
    description:
      "Abnormally high transaction frequency suggesting automation or rapid fund movement.",
    weight: "warning",
  },
  NEW_DEVICE_LARGE_TRANSFER: {
    icon: <Smartphone className="h-4 w-4" />,
    title: "New device, large transfer",
    threshold: "High-value transfer from an unrecognised device",
    description:
      "A significant transfer initiated from a device or session not previously trusted by the customer.",
    weight: "destructive",
  },
  FAILED_LOGINS: {
    icon: <LockKeyhole className="h-4 w-4" />,
    title: "Failed logins",
    threshold: "≥ 5 failed attempts within 15 min",
    description:
      "Repeated authentication failures indicating credential stuffing or account-takeover attempts.",
    weight: "warning",
  },
  ABOVE_NORMAL_BEHAVIOR: {
    icon: <TrendingUp className="h-4 w-4" />,
    title: "Above-normal behaviour",
    threshold: "Activity > 3σ from the 90-day baseline",
    description:
      "Spend, frequency or geography that deviates materially from the customer's behavioural baseline.",
    weight: "warning",
  },
  SANCTIONS_HIT: {
    icon: <ShieldX className="h-4 w-4" />,
    title: "Sanctions hit",
    threshold: "Potential or confirmed screening match",
    description:
      "A name / counterparty match against the sandbox sanctions list. Always the highest priority.",
    weight: "destructive",
  },
};

const RULE_ORDER = Object.values(AmlRuleCode);

export default async function AdminRiskPage() {
  await requirePageAdmin();

  const [scores, distribution] = await Promise.all([
    prisma.riskScore.findMany({
      where: { current: true },
      orderBy: { score: "desc" },
      take: 50,
      include: { user: { select: { id: true, email: true, kycStatus: true, status: true } } },
    }),
    prisma.riskScore.groupBy({
      by: ["level"],
      where: { current: true },
      _count: { _all: true },
    }),
  ]);

  const distMap = new Map<RiskLevel, number>();
  for (const d of distribution) distMap.set(d.level, d._count._all);
  const totalScored = distribution.reduce((sum, d) => sum + d._count._all, 0);

  return (
    <div className="space-y-8">
      <PageHeader
        title={
          <>
            Risk <span className="text-gradient">engine</span>
          </>
        }
        description="Live customer risk scoring and the rule set powering the AML alerting layer."
        actions={
          <span className="inline-flex items-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-3 py-1.5 text-sm font-medium text-muted-foreground backdrop-blur">
            <Users className="h-4 w-4 text-brand-violet" />
            <span className="tabular-nums text-foreground">{totalScored.toLocaleString()}</span> scored
          </span>
        }
      />

      {/* Distribution by level */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {LEVEL_ORDER.map((level) => {
          const n = distMap.get(level) ?? 0;
          const pct = totalScored > 0 ? Math.round((n / totalScored) * 100) : 0;
          const barColor =
            level === RiskLevel.LOW
              ? "bg-success"
              : level === RiskLevel.MEDIUM
                ? "bg-warning"
                : "bg-destructive";
          return (
            <Card key={level} className="glass-card lift group relative overflow-hidden p-5">
              <div className="flex items-center justify-between">
                <Badge variant={levelVariant(level)}>{level}</Badge>
                <span className="text-xs tabular-nums text-muted-foreground">{pct}%</span>
              </div>
              <div className="mt-3 font-display text-3xl font-semibold tabular-nums">
                {n.toLocaleString()}
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                customer{n === 1 ? "" : "s"} scored
              </div>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
              </div>
            </Card>
          );
        })}
      </div>

      {/* Current risk scores */}
      <Card className="glass-card overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand-gradient text-white shadow-glow">
              <GaugeCircle className="h-4 w-4" />
            </span>
            Current risk scores
          </CardTitle>
          <CardDescription>Highest-scoring customers first. Score is 0–100.</CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {scores.length === 0 ? (
            <div className="px-6 pb-6">
              <EmptyState
                title="No risk scores yet"
                description="The risk engine has not scored any customers. Scores appear as activity accrues."
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead className="hidden md:table-cell">Factors</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scores.map((s) => {
                  const factors = Array.isArray(s.factors)
                    ? (s.factors as unknown[]).map((f) =>
                        typeof f === "string" ? f : JSON.stringify(f),
                      )
                    : [];
                  return (
                    <TableRow key={s.id} className="group transition-colors hover:bg-muted/40">
                      <TableCell className="text-sm">
                        {s.user?.email ?? s.userId.slice(0, 8)}
                        <span className="block text-xs text-muted-foreground">
                          {s.user?.kycStatus?.replaceAll("_", " ") ?? "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`text-lg font-semibold tabular-nums ${scoreTone(s.score)}`}>
                          {s.score}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={levelVariant(s.level)}>{s.level}</Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {factors.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {factors.slice(0, 4).map((f, i) => (
                              <span
                                key={i}
                                className="rounded-md bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground"
                              >
                                {f}
                              </span>
                            ))}
                            {factors.length > 4 && (
                              <span className="text-xs text-muted-foreground">
                                +{factors.length - 4}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Rule catalogue */}
      <div className="space-y-4">
        <div>
          <h2 className="font-display text-lg font-semibold tracking-tight">Rule catalogue</h2>
          <p className="text-sm text-muted-foreground">
            The detection rules ({RULE_ORDER.length}) that feed the AML alerting layer, with sandbox
            thresholds.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {RULE_ORDER.map((code) => {
            const doc = RULE_DOCS[code];
            return (
              <Card key={code} className="glass-card ring-glow lift group relative overflow-hidden p-5">
                <div className="flex items-start justify-between gap-2">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand-violet/30 to-brand-violet/5 text-brand-violet ring-1 ring-white/10">
                    {doc.icon}
                  </span>
                  <Badge variant={doc.weight} className="text-[10px]">
                    {code.replaceAll("_", " ")}
                  </Badge>
                </div>
                <h3 className="mt-3 font-display text-sm font-semibold tracking-tight">{doc.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{doc.description}</p>
                <div className="mt-3 rounded-xl border border-border/60 bg-muted/20 px-2.5 py-1.5 text-xs">
                  <span className="font-medium text-muted-foreground">Threshold: </span>
                  {doc.threshold}
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
