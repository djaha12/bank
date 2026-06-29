import { ReceiptText, CheckCircle2, Clock, XCircle, RotateCcw } from "lucide-react";
import { requirePageAdmin } from "@/lib/page-auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/brand/page-header";
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
    <div className="space-y-6">
      <PageHeader
        title="Transactions"
        description="Every money movement on the sandbox ledger. Inspect ledger entries and flag completed transactions for reversal."
        actions={
          <span className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-1.5 text-sm text-muted-foreground">
            <ReceiptText className="h-4 w-4" />
            {total.toLocaleString()} total
          </span>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Completed" value={completed} icon={<CheckCircle2 className="h-4 w-4" />} tone="text-success" />
        <Stat label="Pending" value={pending} icon={<Clock className="h-4 w-4" />} tone="text-warning" />
        <Stat label="Failed" value={failed} icon={<XCircle className="h-4 w-4" />} tone="text-destructive" />
        <Stat label="Reversed" value={reversed} icon={<RotateCcw className="h-4 w-4" />} tone="text-muted-foreground" />
      </div>

      <TransactionsClient initialRows={initialRows} total={total} pageSize={PAGE_SIZE} />
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4 shadow-card dark:shadow-card-dark">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
        <span className={tone}>{icon}</span>
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{value.toLocaleString()}</div>
    </div>
  );
}
