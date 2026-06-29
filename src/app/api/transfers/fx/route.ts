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
import { transferFxSchema } from "@/lib/validation";
import { withIdempotency } from "@/lib/idempotency";
import { executeFxConversion } from "@/lib/operations/fx";
import { prisma } from "@/lib/db";
import { toMinorUnits, serializeBigInt } from "@/lib/money";

export const POST = route(async (req) => {
  const user = await requireKycApprovedUser();
  enforceRateLimit(req, "money", { max: 30, windowMs: 60000 }, user.id);
  const key = getIdempotencyKey(req);
  const body = await parseBody(req, transferFxSchema);

  const from = await prisma.account.findUnique({ where: { id: body.fromAccountId } });
  if (!from || from.deletedAt || from.userId !== user.id) throw Errors.forbidden();

  // Amount is denominated in the SOURCE / base account currency.
  const amount = toMinorUnits(body.amount, from.currency);
  const ctx = getClientContext(req);

  const outcome = await withIdempotency(
    { key, userId: user.id, endpoint: "transfers.fx", body },
    async () => {
      const r = await executeFxConversion({
        userId: user.id,
        fromAccountId: body.fromAccountId,
        toAccountId: body.toAccountId,
        amount,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      });
      return { status: 201, body: serializeBigInt(r), transactionId: r.transactionId };
    },
  );

  return ok(outcome.body, outcome.status);
});
