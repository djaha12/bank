import { route, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const GET = route(async () => {
  const user = await requireUser();

  const application = await prisma.kycApplication.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      documents: {
        orderBy: { createdAt: "asc" },
        select: { id: true, type: true, fileName: true, verified: true, createdAt: true },
      },
    },
  });

  return ok({
    kycStatus: user.kycStatus,
    application: application
      ? {
          id: application.id,
          status: application.status,
          sourceOfFunds: application.sourceOfFunds,
          declaredPepStatus: application.declaredPepStatus,
          rejectionReason: application.rejectionReason,
          submittedAt: application.submittedAt,
          decidedAt: application.decidedAt,
          createdAt: application.createdAt,
        }
      : null,
    documents: application?.documents ?? [],
  });
});
