import { route, ok, parseBody, getClientContext, Errors } from "@/lib/api";
import { requireAdmin, PERMISSIONS } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { serializeBigInt } from "@/lib/money";
import { writeAudit } from "@/lib/audit";
import { notify } from "@/lib/notifications";
import { customerBlockSchema } from "@/lib/validation";
import { UserStatus } from "@prisma/client";

export const GET = route(async (_req, ctx) => {
  await requireAdmin(PERMISSIONS.CUSTOMERS_READ);
  const { id } = await ctx.params;
  if (!id) throw Errors.validation("Customer id is required");

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      profile: true,
      accounts: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
      },
      cards: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          last4: true,
          brand: true,
          type: true,
          status: true,
          expMonth: true,
          expYear: true,
          cardholderName: true,
          createdAt: true,
        },
      },
      kycApplications: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      riskScores: {
        where: { current: true },
        take: 1,
      },
      amlAlerts: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });

  if (!user || user.deletedAt) throw Errors.notFound("Customer not found");

  const latestKyc = user.kycApplications.length > 0 ? user.kycApplications[0] : null;
  const riskScore = user.riskScores.length > 0 ? user.riskScores[0] : null;

  return ok(
    serializeBigInt({
      id: user.id,
      email: user.email,
      status: user.status,
      kycStatus: user.kycStatus,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      profile: user.profile ?? null,
      accounts: user.accounts,
      cards: user.cards,
      latestKyc,
      riskScore,
      recentAlerts: user.amlAlerts,
    }),
  );
});

const ACTION_TO_STATUS: Record<"BLOCK" | "UNBLOCK" | "SUSPEND", UserStatus> = {
  BLOCK: UserStatus.BLOCKED,
  UNBLOCK: UserStatus.ACTIVE,
  SUSPEND: UserStatus.SUSPENDED,
};

const ACTION_TO_AUDIT: Record<"BLOCK" | "UNBLOCK" | "SUSPEND", string> = {
  BLOCK: "admin.customer.block",
  UNBLOCK: "admin.customer.unblock",
  SUSPEND: "admin.customer.suspend",
};

export const PATCH = route(async (req, ctx) => {
  const admin = await requireAdmin(PERMISSIONS.CUSTOMERS_WRITE);
  const { id } = await ctx.params;
  if (!id) throw Errors.validation("Customer id is required");

  const body = await parseBody(req, customerBlockSchema);

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || user.deletedAt) throw Errors.notFound("Customer not found");

  const nextStatus = ACTION_TO_STATUS[body.action];
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { status: nextStatus },
  });

  const clientCtx = getClientContext(req);
  await writeAudit({
    actorType: "ADMIN",
    actorId: admin.id,
    action: ACTION_TO_AUDIT[body.action],
    entity: "User",
    entityId: user.id,
    before: { status: user.status },
    after: { status: updated.status, reason: body.reason },
    metadata: { reason: body.reason },
    ipAddress: clientCtx.ip,
    userAgent: clientCtx.userAgent,
  });

  const notifyTitle =
    body.action === "UNBLOCK" ? "Account reactivated" : "Account access restricted";
  const notifyBody =
    body.action === "UNBLOCK"
      ? "Your account has been reactivated."
      : `Your account has been ${nextStatus.toLowerCase()}. Reason: ${body.reason}`;
  await notify({
    userId: user.id,
    type: "SECURITY",
    title: notifyTitle,
    body: notifyBody,
    metadata: { action: body.action },
  });

  return ok(serializeBigInt({ id: updated.id, status: updated.status }));
});
