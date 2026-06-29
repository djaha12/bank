import { ReceiptText, CheckCircle2, Clock, XCircle, RotateCcw } from "lucide-react";
import { requirePageAdmin } from "@/lib/page-auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/brand/page-header";
import { StatCard } from "@/components/brand/stat-card";
import { AnimatedNumber } from "@/components/brand/animated-number";
import { TransactionStatus } from "@prisma/client";
import { TransactionsClient, type TransactionRow } from "./TransactionsClient";

const PAGE_SIZE = 25;

export default async function AdminTransactionsPage() {
  await requirePageAdmin();

  const [rows, total, completed, pending, failed, reversed] = await Promise.all([
    prisma.transaction.findMany({
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      include: {
        user: { select: { id: true, email: true } },
        ledgerEntries: {
          orderBy: { createdAt: "asc" },
          include: {
            account: { select: { name: true, ownerType: true } },
          },
        },
      },
    }),
    prisma.transaction.count(),
    prisma.transaction.count({ where: { status: TransactionStatus.COMPLETED } }),
    prisma.transaction.count({ where: { status: TransactionStatus.PENDING } }),
    prisma.transaction.count({ where: { status: TransactionStatus.FAILED } }),
    prisma.transaction.count({ where: { status: TransactionStatus.REVERSED } }),
  ]);

  const initialRows: TransactionRow[] = rows.map((t) => ({
    id: t.id,
    type: t.type,
    status: t.status,
    currency: t.currency,
    amount: t.amount.toString(),
    feeAmount: t.feeAmount.toString(),
    description: t.description,
    reference: t.reference,
    userId: t.userId,
    userEmail: t.user?.email ?? null,
    createdAt: t.createdAt.toISOString(),
    ledgerEntries: t.ledgerEntries.map((e) => ({
      id: e.id,
      direction: e.direction,
      amount: e.amount.toString(),
      currency: e.currency,
      balanceAfter: e.balanceAfter.toString(),
      accountId: e.accountId,
      accountName: e.account?.name ?? null,
      ownerType: e.account?.ownerType ?? null,
      createdAt: e.createdAt.toISOString(),
    })),
  }));

  return (
    <div className="space-y-8">
      <PageHeader
        title={
          <>
            Transaction <span className="text-gradient">ledger</span>
          </>
        }
        description="Every money movement on the sandbox ledger. Inspect ledger entries and flag completed transactions for reversal."
        actions={
          <span className="inline-flex items-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-3 py-1.5 text-sm font-medium text-muted-foreground backdrop-blur">
            <ReceiptText className="h-4 w-4 text-brand-violet" />
            <span className="tabular-nums text-foreground">{total.toLocaleString()}</span> total
          </span>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Completed"
          accent="emerald"
          index={0}
          value={<AnimatedNumber value={completed} />}
          hint="settled"
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
        <StatCard
          label="Pending"
          accent="cyan"
          index={1}
          value={<AnimatedNumber value={pending} />}
          hint="in flight"
          icon={<Clock className="h-4 w-4" />}
        />
        <StatCard
          label="Failed"
          accent="violet"
          index={2}
          value={<AnimatedNumber value={failed} />}
          hint="rejected"
          icon={<XCircle className="h-4 w-4" />}
        />
        <StatCard
          label="Reversed"
          accent="blue"
          index={3}
          value={<AnimatedNumber value={reversed} />}
          hint="compensated"
          icon={<RotateCcw className="h-4 w-4" />}
        />
      </div>

      <TransactionsClient initialRows={initialRows} total={total} pageSize={PAGE_SIZE} />
    </div>
  );
}
