import {
  route,
  ok,
  parseBody,
  getClientContext,
  getIdempotencyKey,
  enforceRateLimit,
  Errors,
} from "@/lib/api";
import { requireKycApprovedUser } from "@/lib/auth";
import { cardPurchaseSchema } from "@/lib/validation";
import { withIdempotency } from "@/lib/idempotency";
import { simulateCardPurchase } from "@/lib/operations/cards";
import { prisma } from "@/lib/db";
import { toMinorUnits, serializeBigInt } from "@/lib/money";

export const POST = route(async (req, ctx) => {
  const user = await requireKycApprovedUser();
  enforceRateLimit(req, "money", { max: 30, windowMs: 60000 }, user.id);
  const key = getIdempotencyKey(req);
  const { id } = await ctx.params;
  if (!id) throw Errors.validation("Card id is required");
  const body = await parseBody(req, cardPurchaseSchema);

  // Look up the card to verify ownership and resolve the account currency.
  const card = await prisma.card.findUnique({
    where: { id },
    include: { account: true },
  });
  if (!card || card.deletedAt || card.userId !== user.id) throw Errors.notFound("Card not found");

  const amount = toMinorUnits(body.amount, card.account.currency);
  const clientCtx = getClientContext(req);

  const outcome = await withIdempotency(
    { key, userId: user.id, endpoint: "cards.simulate-purchase", body: { cardId: id, ...body } },
    async () => {
      const r = await simulateCardPurchase({
        userId: user.id,
        cardId: id,
        amount,
        merchantName: body.merchantName,
        mcc: body.mcc,
        capture: body.capture,
        ip: clientCtx.ip,
        userAgent: clientCtx.userAgent,
      });
      return { status: 201, body: serializeBigInt(r), transactionId: r.transactionId };
    },
  );

  return ok(outcome.body, outcome.status);
});
