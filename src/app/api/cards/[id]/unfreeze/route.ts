import { route, ok, getClientContext, Errors } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { serializeBigInt } from "@/lib/money";
import { writeAudit } from "@/lib/audit";
import { notify } from "@/lib/notifications";
import { CardStatus } from "@prisma/client";

export const POST = route(async (req, ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  if (!id) throw Errors.validation("Card id is required");

  const card = await prisma.card.findUnique({ where: { id } });
  if (!card || card.deletedAt || card.userId !== user.id) throw Errors.notFound("Card not found");
  // Explicit state machine: only a FROZEN card can be unfrozen.
  if (card.status === CardStatus.CLOSED) throw Errors.blocked("Card is closed");
  if (card.status !== CardStatus.FROZEN) throw Errors.conflict("Card is not frozen");

  const updated = await prisma.card.update({
    where: { id: card.id },
    data: { status: CardStatus.ACTIVE },
  });

  const clientCtx = getClientContext(req);
  await writeAudit({
    actorType: "USER",
    actorId: user.id,
    action: "card.unfreeze",
    entity: "Card",
    entityId: card.id,
    before: { status: card.status },
    after: { status: updated.status },
    ipAddress: clientCtx.ip,
    userAgent: clientCtx.userAgent,
  });
  await notify({
    userId: user.id,
    type: "CARD",
    title: "Card unfrozen",
    body: `Your card ending ${card.last4} is active again.`,
    metadata: { cardId: card.id },
  });

  return ok(serializeBigInt({ id: updated.id, status: updated.status }));
});
