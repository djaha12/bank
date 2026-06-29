import { route, ok } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const GET = route(async () => {
  const user = await getCurrentUser();
  if (!user) return ok(null);

  const profile = await prisma.customerProfile.findUnique({
    where: { userId: user.id },
  });

  return ok({
    user: {
      id: user.id,
      email: user.email,
      status: user.status,
      kycStatus: user.kycStatus,
    },
    profile,
  });
});
