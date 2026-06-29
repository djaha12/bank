import { Gavel, CheckCircle2, Search, XCircle } from "lucide-react";
import { requirePageAdmin } from "@/lib/page-auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/brand/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/brand/stat-card";
import { AnimatedNumber } from "@/components/brand/animated-number";
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
    <div className="space-y-8">
      <PageHeader
        title={
          <>
            Dispute <span className="text-gradient">desk</span>
          </>
        }
        description="Chargeback and transaction disputes. Resolve with an optional refund or reject with a reason."
        actions={
          <span className="inline-flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/10 px-3 py-1.5 text-sm font-medium text-warning backdrop-blur">
            <Gavel className="h-4 w-4" />
            <span className="tabular-nums">{open + investigating}</span> open
          </span>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Open"
          accent="cyan"
          index={0}
          value={<AnimatedNumber value={open} />}
          hint="awaiting triage"
          icon={<Gavel className="h-4 w-4" />}
        />
        <StatCard
          label="Investigating"
          accent="violet"
          index={1}
          value={<AnimatedNumber value={investigating} />}
          hint="in progress"
          icon={<Search className="h-4 w-4" />}
        />
        <StatCard
          label="Resolved"
          accent="emerald"
          index={2}
          value={<AnimatedNumber value={resolved} />}
          hint="closed"
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
        <StatCard
          label="Rejected"
          accent="blue"
          index={3}
          value={<AnimatedNumber value={rejected} />}
          hint="declined"
          icon={<XCircle className="h-4 w-4" />}
        />
      </div>

      {rows.length === 0 ? (
        <Card className="glass-card">
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
