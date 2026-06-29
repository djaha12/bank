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
  if (card.status === CardStatus.CLOSED) throw Errors.blocked("Card is closed");

  const updated = await prisma.card.update({
    where: { id: card.id },
    data: { status: CardStatus.FROZEN },
  });

  const clientCtx = getClientContext(req);
  await writeAudit({
    actorType: "USER",
    actorId: user.id,
    action: "card.freeze",
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
    title: "Card frozen",
    body: `Your card ending ${card.last4} has been frozen.`,
    metadata: { cardId: card.id },
  });

  return ok(serializeBigInt({ id: updated.id, status: updated.status }));
});
