import { route, ok, parseBody, getClientContext, enforceRateLimit, Errors } from "@/lib/api";
import { loginSchema } from "@/lib/validation";
import { verifyCredentials } from "@/lib/auth";
import { createCustomerSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";

export const POST = route(async (req) => {
  enforceRateLimit(req, "auth", { max: 10, windowMs: 60000 });
  const body = await parseBody(req, loginSchema);
  const ctx = getClientContext(req);

  const user = await verifyCredentials(body.email, body.password);
  if (!user) {
    await prisma.loginEvent.create({
      data: {
        email: body.email.toLowerCase().trim(),
        success: false,
        reason: "INVALID_CREDENTIALS",
        ipAddress: ctx.ip ?? undefined,
        userAgent: ctx.userAgent ?? undefined,
      },
    });
    throw Errors.unauthorized("Invalid email or password");
  }

  await createCustomerSession(user.id, {
    userAgent: ctx.userAgent,
    ip: ctx.ip,
  });

  await prisma.loginEvent.create({
    data: {
      userId: user.id,
      email: user.email,
      success: true,
      ipAddress: ctx.ip ?? undefined,
      userAgent: ctx.userAgent ?? undefined,
    },
  });

  await writeAudit({
    actorType: "USER",
    actorId: user.id,
    action: "auth.login",
    entity: "User",
    entityId: user.id,
    ipAddress: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return ok({ user: { id: user.id, email: user.email, kycStatus: user.kycStatus } });
});
