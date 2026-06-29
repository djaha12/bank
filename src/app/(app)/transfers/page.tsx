import { Wallet } from "lucide-react";
import { PageHeader } from "@/components/brand/page-header";
import { EmptyState } from "@/components/brand/states";
import { requirePageUser } from "@/lib/page-auth";
import { prisma } from "@/lib/db";
import { TransfersClient, type TransferAccountVM } from "./TransfersClient";

export const dynamic = "force-dynamic";

/**
 * Transfers — server component. Loads the user's own active accounts and hands
 * serialized props (BigInt → string) to the interactive client. The client
 * drives the Own / P2P / Bank / QR / Scheduled flows against the money APIs.
 */
export default async function TransfersPage() {
  const user = await requirePageUser();

  const accounts = await prisma.account.findMany({
    where: { userId: user.id, deletedAt: null, status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      currency: true,
      displayNumber: true,
      balanceCached: true,
      holdTotal: true,
    },
    orderBy: { createdAt: "asc" },
  });

  // BigInt cannot cross the server→client boundary — convert to strings here.
  const accountVMs: TransferAccountVM[] = accounts.map((a) => ({
    id: a.id,
    name: a.name,
    currency: a.currency,
    displayNumber: a.displayNumber,
    balance: a.balanceCached.toString(),
    available: (a.balanceCached - a.holdTotal).toString(),
  }));

  const kycApproved = user.kycStatus === "APPROVED";

  return (
    <div className="space-y-8">
      <PageHeader
        title={
          <>
            Move <span className="text-gradient">money</span>
          </>
        }
        description="Between your accounts, to people, or out to a bank. All sandbox, all instant."
      />
      {accountVMs.length === 0 ? (
        <EmptyState
          icon={<Wallet className="h-6 w-6" />}
          title="No accounts to send from"
          description="You need at least one active account before you can transfer money."
        />
      ) : (
        <TransfersClient accounts={accountVMs} kycApproved={kycApproved} />
      )}
    </div>
  );
}
