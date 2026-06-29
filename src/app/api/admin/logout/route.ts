import { route, ok, getClientContext } from "@/lib/api";
import { getAdmin } from "@/lib/rbac";
import { destroyAdminSession } from "@/lib/session";
import { writeAudit } from "@/lib/audit";

export const POST = route(async (req) => {
  const ctx = getClientContext(req);
  const admin = await getAdmin();
  await destroyAdminSession();
  if (admin) {
    await writeAudit({
      actorType: "ADMIN",
      actorId: admin.id,
      action: "admin.logout",
      entity: "AdminUser",
      entityId: admin.id,
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent,
    });
  }
  return ok({ ok: true });
});
