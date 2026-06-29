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
import { transferBankSchema } from "@/lib/validation";
import { withIdempotency } from "@/lib/idempotency";
import { executeTransfer } from "@/lib/operations/transfers";
import { prisma } from "@/lib/db";
import { toMinorUnits, serializeBigInt } from "@/lib/money";
import { TransferKind } from "@prisma/client";

export const POST = route(async (req) => {
  const user = await requireKycApprovedUser();
  enforceRateLimit(req, "money", { max: 30, windowMs: 60000 }, user.id);
  const key = getIdempotencyKey(req);
  const body = await parseBody(req, transferBankSchema);

  const from = await prisma.account.findUnique({ where: { id: body.fromAccountId } });
  if (!from || from.deletedAt || from.userId !== user.id) throw Errors.forbidden();

  const amount = toMinorUnits(body.amount, from.currency);
  const ctx = getClientContext(req);

  // Bank transfers settle to SETTLEMENT (no toAccountId); pass counterparty through.
  const counterparty = {
    name: body.counterparty.name,
    ...(body.counterparty.ibanMasked ? { ibanMasked: body.counterparty.ibanMasked } : {}),
    ...(body.counterparty.bank ? { bank: body.counterparty.bank } : {}),
    ...(body.counterparty.country ? { country: body.counterparty.country } : {}),
  };

  const outcome = await withIdempotency(
    { key, userId: user.id, endpoint: "transfers.bank", body },
    async () => {
      const r = await executeTransfer({
        userId: user.id,
        kind: TransferKind.BANK,
        fromAccountId: body.fromAccountId,
        toAccountId: null,
        counterparty,
        amount,
        note: body.note,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      });
      return { status: 201, body: serializeBigInt(r), transactionId: r.transactionId };
    },
  );

  return ok(outcome.body, outcome.status);
});
