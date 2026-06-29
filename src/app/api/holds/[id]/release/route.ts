import { route, ok, Errors } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { releaseHold } from "@/lib/operations/holds";
import { prisma } from "@/lib/db";
import { serializeBigInt } from "@/lib/money";

export const POST = route(async (_req, ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  if (!id) throw Errors.validation("Hold id required");

  const hold = await prisma.hold.findUnique({ where: { id }, include: { account: true } });
  if (!hold || hold.account.userId !== user.id) throw Errors.notFound("Hold not found");

  const r = await releaseHold({ holdId: id, reason: "released by customer", actorType: "USER", actorId: user.id });
  return ok(serializeBigInt(r));
});
