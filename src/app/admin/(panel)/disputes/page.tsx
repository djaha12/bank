import { Gavel, CheckCircle2 } from "lucide-react";
import { requirePageAdmin } from "@/lib/page-auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/brand/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/brand/states";
import { DisputeStatus } from "@prisma/client";
import { DisputesClient, type DisputeRow } from "./DisputesClient";

export default async function AdminDisputesPage() {
  await requirePageAdmin();

  const [disputes, open, investigating, resolved, rejected] = await Promise.all([
    prisma.dispute.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        user: { select: { id: true, email: true } },
        transaction: { select: { id: true, reference: true, type: true, status: true } },
      },
    }),
    prisma.dispute.count({ where: { status: DisputeStatus.OPEN } }),
    prisma.dispute.count({ where: { status: DisputeStatus.INVESTIGATING } }),
    prisma.dispute.count({ where: { status: DisputeStatus.RESOLVED } }),
    prisma.dispute.count({ where: { status: DisputeStatus.REJECTED } }),
  ]);

  const rows: DisputeRow[] = disputes.map((d) => ({
    id: d.id,
    userId: d.userId,
    userEmail: d.user?.email ?? null,
    transactionId: d.transactionId,
    transactionRef: d.transaction?.reference ?? d.transaction?.id?.slice(0, 8) ?? null,
    transactionType: d.transaction?.type ?? null,
    reason: d.reason,
    status: d.status,
    amount: d.amount.toString(),
    currency: d.currency,
    resolution: d.resolution,
    handledBy: d.handledBy,
    createdAt: d.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Disputes"
        description="Chargeback and transaction disputes. Resolve with an optional refund or reject with a reason."
        actions={
          <span className="inline-flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-1.5 text-sm text-warning">
            <Gavel className="h-4 w-4" />
            {open + investigating} open
          </span>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Open" value={open} tone="text-warning" />
        <Stat label="Investigating" value={investigating} tone="text-primary" />
        <Stat label="Resolved" value={resolved} tone="text-success" />
        <Stat label="Rejected" value={rejected} tone="text-destructive" />
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-4">
            <EmptyState
              title="No disputes"
              description="No customers have raised disputes. New cases will appear here."
              icon={<CheckCircle2 className="h-6 w-6" />}
            />
          </CardContent>
        </Card>
      ) : (
        <DisputesClient rows={rows} />
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4 shadow-card dark:shadow-card-dark">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-2 text-2xl font-semibold tabular-nums ${tone}`}>
        {value.toLocaleString()}
      </div>
    </div>
  );
}
