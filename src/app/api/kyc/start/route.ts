import { route, ok, getClientContext } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { KycStatus } from "@prisma/client";

export const POST = route(async (req) => {
  const user = await requireUser();
  const ctx = getClientContext(req);

  const existing = await prisma.kycApplication.findFirst({
    where: { userId: user.id, status: KycStatus.PENDING },
    orderBy: { createdAt: "desc" },
  });

  const application =
    existing ??
    (await prisma.kycApplication.create({
      data: { userId: user.id, status: KycStatus.PENDING },
    }));

  if (user.kycStatus !== KycStatus.PENDING) {
    await prisma.user.update({
      where: { id: user.id },
      data: { kycStatus: KycStatus.PENDING },
    });
  }

  if (!existing) {
    await writeAudit({
      actorType: "USER",
      actorId: user.id,
      action: "kyc.start",
      entity: "KycApplication",
      entityId: application.id,
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent,
    });
  }

  return ok({
    application: {
      id: application.id,
      status: application.status,
      createdAt: application.createdAt,
    },
    kycStatus: KycStatus.PENDING,
  });
});
