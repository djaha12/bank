import { route, ok, Errors } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { serializeBigInt } from "@/lib/money";

export const GET = route(async (_req, ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  if (!id) throw Errors.validation("Transfer id is required");

  const transfer = await prisma.transfer.findUnique({
    where: { id },
    include: {
      transaction: { include: { ledgerEntries: true } },
    },
  });

  if (!transfer || transfer.userId !== user.id) throw Errors.notFound("Transfer not found");

  const cp = (transfer.counterparty ?? null) as { name?: string; country?: string } | null;

  const receipt = {
    id: transfer.id,
    reference: transfer.transaction.reference,
    kind: transfer.kind,
    amount: transfer.amount,
    currency: transfer.currency,
    fee: transfer.transaction.feeAmount,
    status: transfer.transaction.status,
    note: transfer.note,
    from: {
      accountId: transfer.fromAccountId,
    },
    to: {
      accountId: transfer.toAccountId,
      counterparty: cp,
    },
    transaction: {
      id: transfer.transaction.id,
      type: transfer.transaction.type,
      description: transfer.transaction.description,
      postedAt: transfer.transaction.postedAt,
    },
    ledgerEntries: transfer.transaction.ledgerEntries.map((e) => ({
      id: e.id,
      accountId: e.accountId,
      direction: e.direction,
      amount: e.amount,
      currency: e.currency,
      balanceAfter: e.balanceAfter,
    })),
    createdAt: transfer.createdAt,
  };

  return ok(serializeBigInt(receipt));
});
