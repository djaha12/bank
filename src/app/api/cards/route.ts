import { randomBytes, randomInt } from "node:crypto";
import { route, ok, parseBody, getClientContext, Errors } from "@/lib/api";
import { requireUser, requireKycApprovedUser } from "@/lib/auth";
import { cardCreateSchema } from "@/lib/validation";
import { prisma } from "@/lib/db";
import { serializeBigInt } from "@/lib/money";
import { writeAudit } from "@/lib/audit";
import { AccountStatus, CardType } from "@prisma/client";

/** List the current user's cards (display-only fields; no PAN ever exists). */
export const GET = route(async () => {
  const user = await requireUser();
  const cards = await prisma.card.findMany({
    where: { userId: user.id, deletedAt: null },
    include: { limit: true },
    orderBy: { createdAt: "desc" },
  });

  const safe = cards.map((c) => ({
    id: c.id,
    accountId: c.accountId,
    type: c.type,
    status: c.status,
    last4: c.last4,
    brand: c.brand,
    expMonth: c.expMonth,
    expYear: c.expYear,
    cardholderName: c.cardholderName,
    onlinePaymentsEnabled: c.onlinePaymentsEnabled,
    atmEnabled: c.atmEnabled,
    contactlessEnabled: c.contactlessEnabled,
    limit: c.limit
      ? {
          dailyLimit: c.limit.dailyLimit,
          monthlyLimit: c.limit.monthlyLimit,
          perTxLimit: c.limit.perTxLimit,
          atmDailyLimit: c.limit.atmDailyLimit,
        }
      : null,
    createdAt: c.createdAt,
  }));

  return ok(serializeBigInt(safe));
});

/** Issue a new VIRTUAL_DEBIT card for an owned account. Never stores a real PAN. */
export const POST = route(async (req) => {
  const user = await requireKycApprovedUser();
  const body = await parseBody(req, cardCreateSchema);

  const account = await prisma.account.findUnique({ where: { id: body.accountId } });
  if (!account || account.deletedAt || account.userId !== user.id) throw Errors.forbidden();
  if (account.status !== AccountStatus.ACTIVE) {
    throw Errors.blocked("Account is not active");
  }

  // Display-only last4 (random digits) + opaque network-token reference.
  const last4 = String(randomInt(0, 10000)).padStart(4, "0");
  const tokenRef = `tok_${randomBytes(16).toString("hex")}`;
  const now = new Date();
  const expMonth = now.getUTCMonth() + 1;
  const expYear = now.getUTCFullYear() + 4;

  const card = await prisma.card.create({
    data: {
      userId: user.id,
      accountId: account.id,
      type: CardType.VIRTUAL_DEBIT,
      last4,
      tokenRef,
      expMonth,
      expYear,
      cardholderName: body.cardholderName,
      limit: { create: {} },
    },
    include: { limit: true },
  });

  const ctx = getClientContext(req);
  await writeAudit({
    actorType: "USER",
    actorId: user.id,
    action: "card.create",
    entity: "Card",
    entityId: card.id,
    after: { last4: card.last4, accountId: card.accountId, type: card.type },
    ipAddress: ctx.ip,
    userAgent: ctx.userAgent,
  });

  const safe = {
    id: card.id,
    accountId: card.accountId,
    type: card.type,
    status: card.status,
    last4: card.last4,
    brand: card.brand,
    expMonth: card.expMonth,
    expYear: card.expYear,
    cardholderName: card.cardholderName,
    onlinePaymentsEnabled: card.onlinePaymentsEnabled,
    atmEnabled: card.atmEnabled,
    contactlessEnabled: card.contactlessEnabled,
    limit: card.limit
      ? {
          dailyLimit: card.limit.dailyLimit,
          monthlyLimit: card.limit.monthlyLimit,
          perTxLimit: card.limit.perTxLimit,
          atmDailyLimit: card.limit.atmDailyLimit,
        }
      : null,
    createdAt: card.createdAt,
  };

  return ok(serializeBigInt(safe), 201);
});
