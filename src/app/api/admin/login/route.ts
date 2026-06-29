import { route, ok, parseBody, getClientContext, enforceRateLimit, Errors } from "@/lib/api";
import { adminLoginSchema } from "@/lib/validation";
import { verifyPassword } from "@/lib/crypto";
import { createAdminSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";

export const POST = route(async (req) => {
  enforceRateLimit(req, "auth", { max: 10, windowMs: 60000 });
  const body = await parseBody(req, adminLoginSchema);
  const ctx = getClientContext(req);

  const admin = await prisma.adminUser.findUnique({
    where: { email: body.email.toLowerCase().trim() },
  });
  if (!admin || !admin.active || admin.deletedAt || !verifyPassword(body.password, admin.passwordHash)) {
    throw Errors.unauthorized("Invalid admin credentials");
  }

  await createAdminSession(admin.id);

  await writeAudit({
    actorType: "ADMIN",
    actorId: admin.id,
    action: "admin.login",
    entity: "AdminUser",
    entityId: admin.id,
    ipAddress: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return ok({
    admin: { id: admin.id, email: admin.email, firstName: admin.firstName, lastName: admin.lastName },
  });
});
