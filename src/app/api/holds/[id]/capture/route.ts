import { route, ok, getIdempotencyKey, enforceRateLimit, Errors } from "@/lib/api";
import { requireKycApprovedUser } from "@/lib/auth";
import { withIdempotency } from "@/lib/idempotency";
import { captureHold } from "@/lib/operations/holds";
import { prisma } from "@/lib/db";
import { serializeBigInt } from "@/lib/money";

export const POST = route(async (req, ctx) => {
  const user = await requireKycApprovedUser();
  enforceRateLimit(req, "money", { max: 30, windowMs: 60000 }, user.id);
  const { id } = await ctx.params;
  if (!id) throw Errors.validation("Hold id required");
  const key = getIdempotencyKey(req);

  const hold = await prisma.hold.findUnique({ where: { id }, include: { account: true } });
  if (!hold || hold.account.userId !== user.id) throw Errors.notFound("Hold not found");

  const outcome = await withIdempotency(
    { key, userId: user.id, endpoint: "holds.capture", body: { id } },
    async () => {
      const r = await captureHold({ holdId: id, actorType: "USER", actorId: user.id });
      return { status: 200, body: serializeBigInt(r) };
    },
  );
  return ok(outcome.body, outcome.status);
});
