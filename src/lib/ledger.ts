import {
  Currency,
  LedgerDirection,
  Prisma,
  TransactionStatus,
  TransactionType,
} from "@prisma/client";
import type { Tx } from "@/lib/db";

/**
 * ============================================================================
 * Double-entry ledger
 * ----------------------------------------------------------------------------
 * Core rules (see ARCHITECTURE.md "Ledger model"):
 *  - The ledger is APPEND-ONLY. Entries are never updated or deleted.
 *  - Every posting has >= 2 legs and balances PER CURRENCY:
 *        sum(DEBIT amounts) === sum(CREDIT amounts)   for each currency.
 *  - Leg amounts are positive minor units; the direction carries the sign.
 *  - A USER account balance INCREASES on CREDIT and DECREASES on DEBIT
 *    (the customer's bank-statement convention: credit = money in).
 *  - Cross-currency movements (FX) balance independently per currency by
 *    routing through SYSTEM FX_POSITION accounts.
 *
 * The pure functions below (buildable + checkable without a DB) make the
 * invariants unit-testable. `postTransaction` performs the atomic write.
 * ============================================================================
 */

export interface PostingLeg {
  accountId: string;
  direction: LedgerDirection;
  amount: bigint; // positive minor units
  currency: Currency;
}

export interface PostingPlan {
  type: TransactionType;
  /** Principal currency + amount (informational; truth lives in the legs). */
  currency: Currency;
  amount: bigint;
  feeAmount?: bigint;
  description?: string;
  reference?: string;
  userId?: string | null;
  idempotencyKey?: string | null;
  relatedTransactionId?: string | null;
  metadata?: Prisma.InputJsonValue;
  status?: TransactionStatus;
  legs: PostingLeg[];
}

export class LedgerError extends Error {
  constructor(
    message: string,
    public readonly code: string = "LEDGER_ERROR",
  ) {
    super(message);
    this.name = "LedgerError";
  }
}

/** Signed delta a leg applies to its account balance. */
export function legDelta(leg: Pick<PostingLeg, "direction" | "amount">): bigint {
  return leg.direction === LedgerDirection.CREDIT ? leg.amount : -leg.amount;
}

/**
 * Validate a posting plan WITHOUT touching the database. Throws LedgerError on
 * any invariant violation. This is the function the unit tests hammer.
 */
export function assertBalancedPlan(plan: PostingPlan): void {
  if (plan.legs.length < 2) {
    throw new LedgerError("A posting requires at least two legs", "TOO_FEW_LEGS");
  }

  // Per-currency debit/credit totals must match.
  const byCurrency = new Map<Currency, { debit: bigint; credit: bigint }>();
  for (const leg of plan.legs) {
    if (leg.amount <= 0n) {
      throw new LedgerError(
        `Leg amount must be positive (got ${leg.amount})`,
        "NON_POSITIVE_LEG",
      );
    }
    const acc = byCurrency.get(leg.currency) ?? { debit: 0n, credit: 0n };
    if (leg.direction === LedgerDirection.DEBIT) acc.debit += leg.amount;
    else acc.credit += leg.amount;
    byCurrency.set(leg.currency, acc);
  }

  for (const [currency, totals] of byCurrency) {
    if (totals.debit !== totals.credit) {
      throw new LedgerError(
        `Unbalanced ${currency} posting: debit ${totals.debit} != credit ${totals.credit}`,
        "UNBALANCED",
      );
    }
  }
}

/** Net signed delta per account from a plan (used to check/update balances). */
export function balanceDeltas(plan: PostingPlan): Map<string, bigint> {
  const deltas = new Map<string, bigint>();
  for (const leg of plan.legs) {
    deltas.set(leg.accountId, (deltas.get(leg.accountId) ?? 0n) + legDelta(leg));
  }
  return deltas;
}

/**
 * Atomically post a balanced transaction: creates the Transaction, appends
 * LedgerEntry rows, and updates each account's cached balance projection.
 *
 * MUST be called inside a DB transaction (`prisma.$transaction(...)`). The
 * caller is responsible for pre-flight checks (sufficient funds, limits, risk,
 * idempotency) — this function enforces the accounting invariants only.
 */
export async function postTransaction(tx: Tx, plan: PostingPlan) {
  assertBalancedPlan(plan);

  const status = plan.status ?? TransactionStatus.COMPLETED;
  const posted = status === TransactionStatus.COMPLETED;

  const transaction = await tx.transaction.create({
    data: {
      type: plan.type,
      status,
      currency: plan.currency,
      amount: plan.amount,
      feeAmount: plan.feeAmount ?? 0n,
      description: plan.description,
      reference: plan.reference,
      userId: plan.userId ?? undefined,
      idempotencyKey: plan.idempotencyKey ?? undefined,
      relatedTransactionId: plan.relatedTransactionId ?? undefined,
      metadata: plan.metadata,
      postedAt: posted ? new Date() : null,
    },
  });

  // Lock + load every involved account so concurrent postings serialize on
  // the same rows. SELECT ... FOR UPDATE via raw query (Prisma has no native
  // row-lock API). Account ids are validated UUIDs from our own tables.
  const accountIds = [...new Set(plan.legs.map((l) => l.accountId))];
  const locked = await tx.$queryRaw<
    { id: string; balanceCached: bigint; currency: Currency; status: string }[]
  >`SELECT id, "balanceCached", currency, status FROM "Account" WHERE id IN (${Prisma.join(
    accountIds,
  )}) FOR UPDATE`;

  const balances = new Map<string, bigint>();
  const currencies = new Map<string, Currency>();
  for (const row of locked) {
    balances.set(row.id, BigInt(row.balanceCached));
    currencies.set(row.id, row.currency);
  }

  for (const leg of plan.legs) {
    if (!balances.has(leg.accountId)) {
      throw new LedgerError(`Account not found: ${leg.accountId}`, "ACCOUNT_NOT_FOUND");
    }
    if (currencies.get(leg.accountId) !== leg.currency) {
      throw new LedgerError(
        `Leg currency ${leg.currency} != account currency for ${leg.accountId}`,
        "CURRENCY_MISMATCH",
      );
    }
    const next = (balances.get(leg.accountId) ?? 0n) + legDelta(leg);
    balances.set(leg.accountId, next);

    await tx.ledgerEntry.create({
      data: {
        transactionId: transaction.id,
        accountId: leg.accountId,
        direction: leg.direction,
        amount: leg.amount,
        currency: leg.currency,
        balanceAfter: next,
      },
    });
  }

  // Persist the cached balance projection for every touched account.
  for (const [accountId, newBalance] of balances) {
    await tx.account.update({
      where: { id: accountId },
      data: { balanceCached: newBalance },
    });
  }

  return transaction;
}

/**
 * Recompute an account's balance directly from its ledger entries. Used by the
 * integrity check / tests to prove `balanceCached` never drifts.
 */
export async function recomputeBalance(tx: Tx, accountId: string): Promise<bigint> {
  const entries = await tx.ledgerEntry.findMany({
    where: { accountId },
    select: { direction: true, amount: true },
  });
  return entries.reduce(
    (sum, e) => sum + legDelta({ direction: e.direction, amount: e.amount }),
    0n,
  );
}
