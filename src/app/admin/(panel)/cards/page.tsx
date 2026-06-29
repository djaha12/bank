import { CreditCard, Snowflake, CheckCircle2, XCircle } from "lucide-react";
import { requirePageAdmin } from "@/lib/page-auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/brand/page-header";
import { StatCard } from "@/components/brand/stat-card";
import { AnimatedNumber } from "@/components/brand/animated-number";
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
    <div className="space-y-8">
      <PageHeader
        title={
          <>
            Card <span className="text-gradient">operations</span>
          </>
        }
        description="Cards issued across every customer. Freeze and unfreeze are sandbox operations — no real PANs are ever stored."
        actions={
          <span className="inline-flex items-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-3 py-1.5 text-sm font-medium text-muted-foreground backdrop-blur">
            <CreditCard className="h-4 w-4 text-brand-violet" />
            <span className="tabular-nums text-foreground">{total.toLocaleString()}</span> cards
          </span>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Active"
          accent="emerald"
          index={0}
          value={<AnimatedNumber value={active} />}
          hint="live"
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
        <StatCard
          label="Frozen"
          accent="cyan"
          index={1}
          value={<AnimatedNumber value={frozen} />}
          hint="on hold"
          icon={<Snowflake className="h-4 w-4" />}
        />
        <StatCard
          label="Closed"
          accent="violet"
          index={2}
          value={<AnimatedNumber value={closed} />}
          hint="terminated"
          icon={<XCircle className="h-4 w-4" />}
        />
      </div>

      <CardsClient rows={rows} />
    </div>
  );
}
