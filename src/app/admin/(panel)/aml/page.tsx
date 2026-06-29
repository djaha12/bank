import { Siren, ShieldCheck } from "lucide-react";
import { requirePageAdmin } from "@/lib/page-auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/brand/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/brand/states";
import { RiskLevel } from "@prisma/client";
import { AmlClient, type AmlAlertView } from "./AmlClient";

const LEVEL_ORDER: RiskLevel[] = [
  RiskLevel.CRITICAL,
  RiskLevel.HIGH,
  RiskLevel.MEDIUM,
  RiskLevel.LOW,
];

function toRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

export default async function AdminAmlPage() {
  const admin = await requirePageAdmin();

  const alerts = await prisma.amlAlert.findMany({
    orderBy: [{ createdAt: "desc" }],
    include: {
      user: { select: { id: true, email: true } },
      transaction: { select: { id: true, reference: true, type: true, amount: true, currency: true } },
      assignee: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  const views: AmlAlertView[] = alerts.map((a) => {
    const details = toRecord(a.details);
    return {
      id: a.id,
      userId: a.userId,
      userEmail: a.user?.email ?? null,
      ruleCode: a.ruleCode,
      level: a.level,
      status: a.status,
      reason: a.reason,
      details: details
        ? Object.entries(details).map(([k, v]) => ({
            key: k,
            value: typeof v === "string" ? v : JSON.stringify(v),
          }))
        : [],
      adminNotes: a.adminNotes,
      assignedTo: a.assignedTo,
      assigneeName: a.assignee
        ? [a.assignee.firstName, a.assignee.lastName].filter(Boolean).join(" ")
        : null,
      transactionRef: a.transaction?.reference ?? a.transaction?.id?.slice(0, 8) ?? null,
      transactionId: a.transactionId,
      transactionAmount: a.transaction?.amount?.toString() ?? null,
      transactionCurrency: a.transaction?.currency ?? null,
      createdAt: a.createdAt.toISOString(),
    };
  });

  const open = views.filter((v) => v.status === "OPEN").length;
  const grouped = LEVEL_ORDER.map((level) => ({
    level,
    items: views.filter((v) => v.level === level),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <>
            AML <span className="text-gradient">alerts</span>
          </>
        }
        description="Financial-crime alerts grouped by severity. Triage, assign and close cases with full audit trail."
        actions={
          <span className="inline-flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-sm font-medium text-destructive backdrop-blur">
            <Siren className="h-4 w-4 animate-glow-pulse" />
            <span className="tabular-nums">{open}</span> open
          </span>
        }
      />

      {views.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="py-4">
            <EmptyState
              title="No alerts raised"
              description="The AML engine has not flagged any activity. New alerts will appear here grouped by severity."
              icon={<ShieldCheck className="h-6 w-6" />}
            />
          </CardContent>
        </Card>
      ) : (
        <AmlClient grouped={grouped} adminId={admin.id} />
      )}
    </div>
  );
}
