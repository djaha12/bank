import { route, ok, parseBody, getClientContext, Errors } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { cardLimitsSchema } from "@/lib/validation";
import { prisma } from "@/lib/db";
import { toMinorUnits, serializeBigInt } from "@/lib/money";
import { writeAudit } from "@/lib/audit";
import { Prisma } from "@prisma/client";

export const PATCH = route(async (req, ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  if (!id) throw Errors.validation("Card id is required");
  const body = await parseBody(req, cardLimitsSchema);

  const card = await prisma.card.findUnique({
    where: { id },
    include: { account: true, limit: true },
  });
  if (!card || card.deletedAt || card.userId !== user.id) throw Errors.notFound("Card not found");

  const currency = card.account.currency;

  // Limit fields parsed in the card account currency (minor units).
  const limitData: {
    dailyLimit?: bigint;
    monthlyLimit?: bigint;
    perTxLimit?: bigint;
    atmDailyLimit?: bigint;
  } = {};
  if (body.dailyLimit !== undefined) limitData.dailyLimit = toMinorUnits(body.dailyLimit, currency);
  if (body.monthlyLimit !== undefined)
    limitData.monthlyLimit = toMinorUnits(body.monthlyLimit, currency);
  if (body.perTxLimit !== undefined) limitData.perTxLimit = toMinorUnits(body.perTxLimit, currency);
  if (body.atmDailyLimit !== undefined)
    limitData.atmDailyLimit = toMinorUnits(body.atmDailyLimit, currency);

  // Card toggles.
  const cardToggles: Prisma.CardUpdateInput = {};
  if (body.onlinePaymentsEnabled !== undefined)
    cardToggles.onlinePaymentsEnabled = body.onlinePaymentsEnabled;
  if (body.atmEnabled !== undefined) cardToggles.atmEnabled = body.atmEnabled;
  if (body.contactlessEnabled !== undefined)
    cardToggles.contactlessEnabled = body.contactlessEnabled;

  const result = await prisma.$transaction(async (tx) => {
    const limit = await tx.cardLimit.upsert({
      where: { cardId: card.id },
      create: { cardId: card.id, ...limitData },
      update: limitData,
    });
    let updatedCard = card;
    if (Object.keys(cardToggles).length > 0) {
      updatedCard = await tx.card.update({
        where: { id: card.id },
        data: cardToggles,
        include: { account: true, limit: true },
      });
    }
    return { limit, card: updatedCard };
  });

  const clientCtx = getClientContext(req);
  await writeAudit({
    actorType: "USER",
    actorId: user.id,
    action: "card.limits.update",
    entity: "Card",
    entityId: card.id,
    before: {
      dailyLimit: card.limit?.dailyLimit.toString() ?? null,
      monthlyLimit: card.limit?.monthlyLimit.toString() ?? null,
      perTxLimit: card.limit?.perTxLimit.toString() ?? null,
      atmDailyLimit: card.limit?.atmDailyLimit.toString() ?? null,
      onlinePaymentsEnabled: card.onlinePaymentsEnabled,
      atmEnabled: card.atmEnabled,
      contactlessEnabled: card.contactlessEnabled,
    },
    after: {
      dailyLimit: result.limit.dailyLimit.toString(),
      monthlyLimit: result.limit.monthlyLimit.toString(),
      perTxLimit: result.limit.perTxLimit.toString(),
      atmDailyLimit: result.limit.atmDailyLimit.toString(),
      onlinePaymentsEnabled: result.card.onlinePaymentsEnabled,
      atmEnabled: result.card.atmEnabled,
      contactlessEnabled: result.card.contactlessEnabled,
    },
    ipAddress: clientCtx.ip,
    userAgent: clientCtx.userAgent,
  });

  return ok(
    serializeBigInt({
      id: result.card.id,
      onlinePaymentsEnabled: result.card.onlinePaymentsEnabled,
      atmEnabled: result.card.atmEnabled,
      contactlessEnabled: result.card.contactlessEnabled,
      limit: {
        dailyLimit: result.limit.dailyLimit,
        monthlyLimit: result.limit.monthlyLimit,
        perTxLimit: result.limit.perTxLimit,
        atmDailyLimit: result.limit.atmDailyLimit,
      },
    }),
  );
});
