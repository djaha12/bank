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
import { transferP2PSchema } from "@/lib/validation";
import { withIdempotency } from "@/lib/idempotency";
import { executeTransfer } from "@/lib/operations/transfers";
import { prisma } from "@/lib/db";
import { toMinorUnits, serializeBigInt } from "@/lib/money";
import { AccountStatus, TransferKind } from "@prisma/client";

export const POST = route(async (req) => {
  const user = await requireKycApprovedUser();
  enforceRateLimit(req, "money", { max: 30, windowMs: 60000 }, user.id);
  const key = getIdempotencyKey(req);
  const body = await parseBody(req, transferP2PSchema);

  const from = await prisma.account.findUnique({ where: { id: body.fromAccountId } });
  if (!from || from.deletedAt || from.userId !== user.id) throw Errors.forbidden();

  // Resolve destination account.
  let toAccountId: string;
  if (body.toAccountId) {
    toAccountId = body.toAccountId;
  } else {
    const recipientEmail = body.recipientEmail;
    if (!recipientEmail) throw Errors.validation("Provide toAccountId or recipientEmail");
    const recipient = await prisma.user.findUnique({
      where: { email: recipientEmail.toLowerCase().trim() },
    });
    if (!recipient || recipient.deletedAt) throw Errors.notFound("Recipient account not found");
    const recipientAccount = await prisma.account.findFirst({
      where: {
        userId: recipient.id,
        currency: from.currency,
        status: AccountStatus.ACTIVE,
        deletedAt: null,
      },
      orderBy: { createdAt: "asc" },
    });
    if (!recipientAccount) throw Errors.notFound("Recipient account not found");
    toAccountId = recipientAccount.id;
  }

  const amount = toMinorUnits(body.amount, from.currency);
  const ctx = getClientContext(req);
  const counterparty = body.counterparty
    ? {
        name: body.counterparty.name,
        ...(body.counterparty.country ? { country: body.counterparty.country } : {}),
      }
    : undefined;

  const outcome = await withIdempotency(
    { key, userId: user.id, endpoint: "transfers.p2p", body },
    async () => {
      const r = await executeTransfer({
        userId: user.id,
        kind: TransferKind.P2P,
        fromAccountId: body.fromAccountId,
        toAccountId,
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
