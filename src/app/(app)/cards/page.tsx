import { CreditCard } from "lucide-react";
import { PageHeader } from "@/components/brand/page-header";
import { EmptyState } from "@/components/brand/states";
import { requirePageUser } from "@/lib/page-auth";
import { prisma } from "@/lib/db";
import { CardsClient, type CardVM } from "./CardsClient";
import { PendingHoldsClient, type HoldVM } from "./PendingHoldsClient";

export const dynamic = "force-dynamic";

/**
 * Cards — server component. Loads the user's own cards (display-only fields,
 * no PAN ever exists in the sandbox) plus their linked-account currency and
 * available balance, then hands serialized props to the interactive client.
 */
export default async function CardsPage() {
  const user = await requirePageUser();

  const cards = await prisma.card.findMany({
    where: { userId: user.id, deletedAt: null },
    include: {
      limit: true,
      merchantControls: { orderBy: { label: "asc" } },
      account: { select: { id: true, name: true, currency: true, balanceCached: true, holdTotal: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Accounts available to issue a new virtual card against.
  const accounts = await prisma.account.findMany({
    where: { userId: user.id, deletedAt: null, status: "ACTIVE" },
    select: { id: true, name: true, currency: true, displayNumber: true },
    orderBy: { createdAt: "asc" },
  });

  // BigInt cannot cross the server→client boundary — convert to strings here.
  const cardVMs: CardVM[] = cards.map((c) => ({
    id: c.id,
    accountId: c.accountId,
    accountName: c.account.name,
    status: c.status,
    last4: c.last4,
    brand: c.brand,
    expMonth: c.expMonth,
    expYear: c.expYear,
    cardholderName: c.cardholderName,
    currency: c.account.currency,
    onlinePaymentsEnabled: c.onlinePaymentsEnabled,
    atmEnabled: c.atmEnabled,
    contactlessEnabled: c.contactlessEnabled,
    availableBalance: (c.account.balanceCached - c.account.holdTotal).toString(),
    limit: c.limit
      ? {
          dailyLimit: c.limit.dailyLimit.toString(),
          monthlyLimit: c.limit.monthlyLimit.toString(),
          perTxLimit: c.limit.perTxLimit.toString(),
          atmDailyLimit: c.limit.atmDailyLimit.toString(),
        }
      : { dailyLimit: "0", monthlyLimit: "0", perTxLimit: "0", atmDailyLimit: "0" },
    merchantControls: c.merchantControls.map((m) => ({
      id: m.id,
      mcc: m.mcc,
      label: m.label,
      blocked: m.blocked,
    })),
  }));

  const accountVMs = accounts.map((a) => ({
    id: a.id,
    name: a.name,
    currency: a.currency,
    displayNumber: a.displayNumber,
  }));

  // Pending (uncaptured) card authorizations — the user can capture or release.
  const heldHolds = await prisma.hold.findMany({
    where: { account: { userId: user.id }, status: "HELD" },
    include: { card: { select: { last4: true } } },
    orderBy: { createdAt: "desc" },
  });
  const holdVMs: HoldVM[] = heldHolds.map((h) => ({
    id: h.id,
    merchantName: h.merchantName,
    mcc: h.mcc,
    amount: h.amount.toString(),
    currency: h.currency,
    cardLast4: h.card?.last4 ?? "••••",
    createdAt: h.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-8">
      <PageHeader
        title={
          <>
            Your <span className="text-gradient">cards</span>
          </>
        }
        description="Virtual debit cards — freeze, set limits, and control exactly where they work."
      />
      {cardVMs.length === 0 && accountVMs.length === 0 ? (
        <EmptyState
          icon={<CreditCard className="h-6 w-6" />}
          title="No cards yet"
          description="You need an active account before you can issue a virtual card."
        />
      ) : (
        <CardsClient
          initialCards={cardVMs}
          accounts={accountVMs}
          defaultCardholder={
            [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email
          }
        />
      )}
      <PendingHoldsClient holds={holdVMs} />
    </div>
  );
}
