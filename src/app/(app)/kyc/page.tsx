import { PageHeader } from "@/components/brand/page-header";
import { requirePageUser } from "@/lib/page-auth";
import { prisma } from "@/lib/db";
import { KycClient, type KycPrefill } from "./KycClient";

export const dynamic = "force-dynamic";

/**
 * KYC onboarding — server component. Prefills the wizard with whatever profile
 * data the user already has (scoped to user.id) and hands the current KYC status
 * to the client, which drives the live status banner and the start/submit flow.
 */
export default async function KycPage() {
  const user = await requirePageUser();

  const profile = await prisma.customerProfile.findUnique({
    where: { userId: user.id },
  });

  const prefill: KycPrefill = {
    firstName: profile?.firstName ?? user.firstName ?? "",
    lastName: profile?.lastName ?? user.lastName ?? "",
    dateOfBirth: profile?.dateOfBirth ? profile.dateOfBirth.toISOString().slice(0, 10) : "",
    nationality: profile?.nationality ?? "",
    country: profile?.country ?? "",
    addressLine1: profile?.addressLine1 ?? "",
    addressLine2: profile?.addressLine2 ?? "",
    city: profile?.city ?? "",
    postalCode: profile?.postalCode ?? "",
    occupation: profile?.occupation ?? "",
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title={
          <>
            Identity <span className="text-gradient">verification</span>
          </>
        }
        description="A few quick steps to unlock transfers, cards and higher limits. Your data is handled with care."
      />
      <KycClient prefill={prefill} initialStatus={user.kycStatus} />
    </div>
  );
}
