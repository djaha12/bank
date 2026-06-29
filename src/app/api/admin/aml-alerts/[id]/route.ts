import { route, ok, parseBody, getClientContext, Errors } from "@/lib/api";
import { requireAdmin, PERMISSIONS } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { serializeBigInt } from "@/lib/money";
import { writeAudit } from "@/lib/audit";
import { amlAlertUpdateSchema } from "@/lib/validation";
import { AlertStatus, Prisma } from "@prisma/client";

export const PATCH = route(async (req, ctx) => {
  const admin = await requireAdmin(PERMISSIONS.AML_WRITE);
  const { id } = await ctx.params;
  if (!id) throw Errors.validation("Alert id is required");

  const body = await parseBody(req, amlAlertUpdateSchema);

  const alert = await prisma.amlAlert.findUnique({ where: { id } });
  if (!alert) throw Errors.notFound("Alert not found");

  const data: Prisma.AmlAlertUpdateInput = {};
  if (body.status) {
    data.status = body.status as AlertStatus;
    data.resolvedAt = body.status === "CLOSED" ? new Date() : null;
  }
  if (body.adminNotes !== undefined) data.adminNotes = body.adminNotes;
  if (body.assignToSelf) data.assignee = { connect: { id: admin.id } };

  const updated = await prisma.amlAlert.update({ where: { id: alert.id }, data });

  const clientCtx = getClientContext(req);
  await writeAudit({
    actorType: "ADMIN",
    actorId: admin.id,
    action: "aml.update",
    entity: "AmlAlert",
    entityId: alert.id,
    before: { status: alert.status, assignedTo: alert.assignedTo, adminNotes: alert.adminNotes },
    after: {
      status: updated.status,
      assignedTo: updated.assignedTo,
      adminNotes: updated.adminNotes,
    },
    ipAddress: clientCtx.ip,
    userAgent: clientCtx.userAgent,
  });

  return ok(
    serializeBigInt({
      id: updated.id,
      status: updated.status,
      assignedTo: updated.assignedTo,
      adminNotes: updated.adminNotes,
      resolvedAt: updated.resolvedAt,
    }),
  );
});
