import { z } from "zod";
import { route, ok, parseBody } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** List the current user's recent notifications + unread count. */
export const GET = route(async () => {
  const user = await requireUser();
  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.notification.count({ where: { userId: user.id, read: false } }),
  ]);
  return ok({ items, unreadCount });
});

const markSchema = z.object({
  all: z.boolean().optional(),
  ids: z.array(z.string().uuid()).max(100).optional(),
});

/** Mark notifications read (all, or a specific set the user owns). */
export const PATCH = route(async (req) => {
  const user = await requireUser();
  const body = await parseBody(req, markSchema);
  if (body.all) {
    await prisma.notification.updateMany({
      where: { userId: user.id, read: false },
      data: { read: true },
    });
  } else if (body.ids?.length) {
    await prisma.notification.updateMany({
      where: { userId: user.id, id: { in: body.ids } },
      data: { read: true },
    });
  }
  const unreadCount = await prisma.notification.count({ where: { userId: user.id, read: false } });
  return ok({ unreadCount });
});
