import { LedgerDirection, TransactionType } from "@prisma/client";
import type { Tx } from "@/lib/db";
import { postTransaction } from "@/lib/ledger";
import { getSystemAccount } from "@/lib/system-accounts";

/**
 * Demo deposit — the ONLY way play money enters a customer account. Funded by
 * the SYSTEM FUNDING account so the global ledger stays balanced. This must
 * NEVER be exposed in a real deployment (it mints money). Sandbox only.
 */
export async function demoDeposit(
  tx: Tx,
  args: { accountId: string; amount: bigint; description?: string },
) {
  const account = await tx.account.findUnique({ where: { id: args.accountId } });
  if (!account) throw new Error(`Account not found: ${args.accountId}`);
  if (args.amount <= 0n) throw new Error("Deposit amount must be positive");

  const funding = await getSystemAccount(tx, "FUNDING", account.currency);
  return postTransaction(tx, {
    type: TransactionType.DEMO_DEPOSIT,
    currency: account.currency,
    amount: args.amount,
    description: args.description ?? "Demo deposit (sandbox)",
    userId: account.userId,
    legs: [
      { accountId: funding, direction: LedgerDirection.DEBIT, amount: args.amount, currency: account.currency },
      { accountId: account.id, direction: LedgerDirection.CREDIT, amount: args.amount, currency: account.currency },
    ],
    metadata: { sandbox: true },
  });
}
