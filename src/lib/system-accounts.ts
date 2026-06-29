import { Currency, SystemAccountKind } from "@prisma/client";
import type { Tx } from "@/lib/db";
import { LedgerError } from "@/lib/ledger";

/**
 * System (internal) accounts make double-entry balance across the whole bank.
 * They are seeded once (see prisma/seed.ts) for each currency where needed.
 * Examples: FUNDING (demo money source), FEE_INCOME, FX_POSITION per currency.
 */
export async function getSystemAccount(
  tx: Tx,
  kind: SystemAccountKind,
  currency: Currency,
): Promise<string> {
  const account = await tx.account.findFirst({
    where: { ownerType: "SYSTEM", systemKind: kind, currency, deletedAt: null },
    select: { id: true },
  });
  if (!account) {
    throw new LedgerError(
      `Missing system account ${kind}/${currency} — run the seed`,
      "SYSTEM_ACCOUNT_MISSING",
    );
  }
  return account.id;
}

export const SYSTEM_ACCOUNT_MATRIX: { kind: SystemAccountKind; currencies: Currency[] }[] = [
  { kind: "FUNDING", currencies: ["KGS", "USD", "EUR"] },
  { kind: "FEE_INCOME", currencies: ["KGS", "USD", "EUR"] },
  { kind: "FX_POSITION", currencies: ["KGS", "USD", "EUR"] },
  { kind: "SETTLEMENT", currencies: ["KGS", "USD", "EUR"] },
  { kind: "SUSPENSE", currencies: ["KGS", "USD", "EUR"] },
  { kind: "CARD_SCHEME", currencies: ["KGS", "USD", "EUR"] },
];
