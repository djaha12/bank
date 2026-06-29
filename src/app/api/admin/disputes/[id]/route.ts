import { route, ok, parseBody, getClientContext, Errors } from "@/lib/api";
import { requireAdmin, PERMISSIONS } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { serializeBigInt } from "@/lib/money";
import { writeAudit } from "@/lib/audit";
import { reverseTransaction } from "@/lib/operations/reversal";
import { disputeUpdateSchema } from "@/lib/validation";
import { DisputeStatus } from "@prisma/client";

export const PATCH = route(async (req, ctx) => {
  const admin = await requireAdmin(PERMISSIONS.DISPUTES_WRITE);
  const { id } = await ctx.params;
  if (!id) throw Errors.validation("Dispute id is required");

  const body = await parseBody(req, disputeUpdateSchema);

  const dispute = await prisma.dispute.findUnique({ where: { id } });
  if (!dispute) throw Errors.notFound("Dispute not found");

  const updated = await prisma.dispute.update({
    where: { id: dispute.id },
    data: {
      status: body.status as DisputeStatus,
      resolution: body.resolution,
      handledBy: admin.id,
    },
  });

  let refund: { reversalId: string; originalId: string } | null = null;
  if (body.refund) {
    refund = await reverseTransaction({
      transactionId: dispute.transactionId,
      reason: body.resolution ?? `Dispute ${dispute.id} resolved with refund`,
      actorType: "ADMIN",
      actorId: admin.id,
      refund: true,
    });
  }

  const clientCtx = getClientContext(req);
  await writeAudit({
    actorType: "ADMIN",
    actorId: admin.id,
    action: "dispute.update",
    entity: "Dispute",
    entityId: dispute.id,
    before: { status: dispute.status, resolution: dispute.resolution },
    after: {
      status: updated.status,
      resolution: updated.resolution,
      refunded: Boolean(refund),
      reversalId: refund?.reversalId ?? null,
    },
    metadata: { refund: Boolean(body.refund) },
    ipAddress: clientCtx.ip,
    userAgent: clientCtx.userAgent,
  });

  return ok(
    serializeBigInt({
      id: updated.id,
      status: updated.status,
      resolution: updated.resolution,
      handledBy: updated.handledBy,
      refund,
    }),
  );
});
