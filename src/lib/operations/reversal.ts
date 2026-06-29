import {
  AuditActorType,
  LedgerDirection,
  TransactionStatus,
  TransactionType,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { Errors } from "@/lib/errors";
import { postTransaction, type PostingLeg } from "@/lib/ledger";
import { writeAudit } from "@/lib/audit";
import { notify } from "@/lib/notifications";

/**
 * Reverse (or refund) a completed transaction by posting a mirror transaction
 * that swaps every leg's direction. The ledger stays append-only — we never
 * mutate the original entries; we add compensating ones.
 */
export async function reverseTransaction(args: {
  transactionId: string;
  reason: string;
  actorType: AuditActorType;
  actorId: string | null;
  refund?: boolean;
}) {
  return prisma.$transaction(
    async (tx) => {
      const original = await tx.transaction.findUnique({
        where: { id: args.transactionId },
        include: { ledgerEntries: true },
      });
      if (!original) throw Errors.notFound("Transaction not found");
      if (original.status === TransactionStatus.REVERSED) {
        throw Errors.conflict("Transaction already reversed");
      }
      if (original.status !== TransactionStatus.COMPLETED) {
        throw Errors.conflict("Only completed transactions can be reversed");
      }
      if (original.ledgerEntries.length === 0) {
        throw Errors.conflict("Transaction has no ledger entries to reverse");
      }

      const legs: PostingLeg[] = original.ledgerEntries.map((e) => ({
        accountId: e.accountId,
        direction:
          e.direction === LedgerDirection.DEBIT ? LedgerDirection.CREDIT : LedgerDirection.DEBIT,
        amount: e.amount,
        currency: e.currency,
      }));

      const reversal = await postTransaction(tx, {
        type: args.refund ? TransactionType.REFUND : TransactionType.REVERSAL,
        currency: original.currency,
        amount: original.amount,
        description: `${args.refund ? "Refund" : "Reversal"}: ${args.reason}`,
        reference: `REV-${Date.now().toString(36).toUpperCase()}`,
        userId: original.userId,
        relatedTransactionId: original.id,
        legs,
        metadata: { reason: args.reason, original: original.id },
      });

      await tx.transaction.update({
        where: { id: original.id },
        data: { status: TransactionStatus.REVERSED },
      });

      await writeAudit(
        {
          actorType: args.actorType,
          actorId: args.actorId,
          action: args.refund ? "transaction.refund" : "transaction.reverse",
          entity: "Transaction",
          entityId: original.id,
          before: { status: original.status },
          after: { status: TransactionStatus.REVERSED, reversalId: reversal.id, reason: args.reason },
        },
        tx,
      );

      if (original.userId) {
        await notify(
          {
            userId: original.userId,
            type: "TRANSACTION",
            title: args.refund ? "Refund issued" : "Transaction reversed",
            body: args.reason,
            metadata: { transactionId: reversal.id, original: original.id },
          },
          tx,
        );
      }

      return { reversalId: reversal.id, originalId: original.id };
    },
    { isolationLevel: "Serializable", timeout: 15000 },
  );
}
