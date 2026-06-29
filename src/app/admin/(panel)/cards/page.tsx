import { CreditCard, Snowflake, CheckCircle2, XCircle } from "lucide-react";
import { requirePageAdmin } from "@/lib/page-auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/brand/page-header";
import { CardStatus } from "@prisma/client";
import { CardsClient, type CardRow } from "./CardsClient";

const PAGE_SIZE = 60;

export default async function AdminCardsPage() {
  await requirePageAdmin();

  const [cards, total, active, frozen, closed] = await Promise.all([
    prisma.card.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      include: {
        user: { select: { id: true, email: true } },
        account: { select: { currency: true, name: true } },
      },
    }),
    prisma.card.count({ where: { deletedAt: null } }),
    prisma.card.count({ where: { deletedAt: null, status: CardStatus.ACTIVE } }),
    prisma.card.count({ where: { deletedAt: null, status: CardStatus.FROZEN } }),
    prisma.card.count({ where: { deletedAt: null, status: CardStatus.CLOSED } }),
  ]);

  const rows: CardRow[] = cards.map((c) => ({
    id: c.id,
    last4: c.last4,
    brand: c.brand,
    status: c.status,
    cardholderName: c.cardholderName,
    expMonth: c.expMonth,
    expYear: c.expYear,
    userId: c.userId,
    userEmail: c.user?.email ?? null,
    currency: c.account?.currency ?? "USD",
    accountName: c.account?.name ?? null,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Card Operations"
        description="Cards issued across every customer. Freeze and unfreeze are sandbox operations — no real PANs are ever stored."
        actions={
          <span className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-1.5 text-sm text-muted-foreground">
            <CreditCard className="h-4 w-4" />
            {total.toLocaleString()} cards
          </span>
        }
      />

      <div className="grid grid-cols-3 gap-4">
        <Stat label="Active" value={active} icon={<CheckCircle2 className="h-4 w-4" />} tone="text-success" />
        <Stat label="Frozen" value={frozen} icon={<Snowflake className="h-4 w-4" />} tone="text-primary" />
        <Stat label="Closed" value={closed} icon={<XCircle className="h-4 w-4" />} tone="text-muted-foreground" />
      </div>

      <CardsClient rows={rows} />
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
