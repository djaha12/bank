import { UserRound } from "lucide-react";
import { PageHeader } from "@/components/brand/page-header";
import { requirePageUser } from "@/lib/page-auth";
import { prisma } from "@/lib/db";
import { ProfileClient, type ProfileVM } from "./ProfileClient";

export const dynamic = "force-dynamic";

/**
 * Profile — server component. Loads the signed-in user's own CustomerProfile and
 * KYC status, masks sensitive fields server-side, and hands serialized props to
 * the interactive client. Scoped strictly to user.id.
 */
export default async function ProfilePage() {
  const user = await requirePageUser();

  const profile = await prisma.customerProfile.findUnique({
    where: { userId: user.id },
  });

  // Mask the email locally: keep first char + domain.
  const maskEmail = (email: string): string => {
    const [local, domain] = email.split("@");
    if (!local || !domain) return email;
    const head = local.slice(0, 1);
    return `${head}${"•".repeat(Math.max(2, local.length - 1))}@${domain}`;
  };

  // Mask phone: keep last 2 digits.
  const maskPhone = (phone: string | null): string | null => {
    if (!phone) return null;
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 4) return "••";
    return `${"•".repeat(Math.max(2, digits.length - 2))}${digits.slice(-2)}`;
  };

  const vm: ProfileVM = {
    firstName: profile?.firstName ?? user.firstName ?? "",
    lastName: profile?.lastName ?? user.lastName ?? "",
    email: user.email,
    emailMasked: maskEmail(user.email),
    phone: profile?.phone ?? null,
    phoneMasked: maskPhone(profile?.phone ?? null),
    dateOfBirth: profile?.dateOfBirth ? profile.dateOfBirth.toISOString().slice(0, 10) : null,
    nationality: profile?.nationality ?? null,
    country: profile?.country ?? null,
    addressLine1: profile?.addressLine1 ?? null,
    addressLine2: profile?.addressLine2 ?? null,
    city: profile?.city ?? null,
    postalCode: profile?.postalCode ?? null,
    occupation: profile?.occupation ?? null,
    sourceOfFunds: profile?.sourceOfFunds ?? null,
    kycStatus: user.kycStatus,
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title={
          <>
            Your <span className="text-gradient">profile</span>
          </>
        }
        description="Manage your personal details, address and privacy preferences."
        actions={
          <div className="hidden items-center gap-2 rounded-full border border-border/60 bg-card/60 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur sm:flex">
            <UserRound className="h-4 w-4 text-primary" />
            Your data, your control
          </div>
        }
      />
      <ProfileClient initial={vm} />
    </div>
  );
}
