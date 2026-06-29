import { route, ok, getClientContext } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { destroyCustomerSession } from "@/lib/session";
import { writeAudit } from "@/lib/audit";

export const POST = route(async (req) => {
  const ctx = getClientContext(req);
  const user = await getCurrentUser();
  await destroyCustomerSession();
  if (user) {
    await writeAudit({
      actorType: "USER",
      actorId: user.id,
      action: "auth.logout",
      entity: "User",
      entityId: user.id,
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent,
    });
  }
  return ok({ ok: true });
});
