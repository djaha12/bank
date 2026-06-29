import { describe, it, expect, beforeAll } from "vitest";
import { prisma } from "@/lib/db";
import { recomputeBalance } from "@/lib/ledger";
import { demoDeposit } from "@/lib/operations/deposit";
import { executeTransfer } from "@/lib/operations/transfers";
import { withIdempotency } from "@/lib/idempotency";
import { verifyAuditChain } from "@/lib/audit";
import { serializeBigInt } from "@/lib/money";
import { AppError } from "@/lib/errors";
import { TransferKind } from "@prisma/client";

/**
 * DB-backed integration tests. Require a migrated + SEEDED database (system
 * accounts must exist). Skipped automatically if the DB is not seeded so a
 * fresh `npm test` does not fail.
 */
let seeded = false;

beforeAll(async () => {
  const funding = await prisma.account
    .findFirst({ where: { ownerType: "SYSTEM", systemKind: "FUNDING", currency: "KGS" } })
    .catch(() => null);
  seeded = Boolean(funding);
});

async function makeUserWithAccounts() {
  const email = `it-${Date.now()}-${Math.random().toString(36).slice(2)}@test.local`;
  const user = await prisma.user.create({
    data: { email, status: "ACTIVE", kycStatus: "APPROVED" },
  });
  const a = await prisma.account.create({
    data: { userId: user.id, currency: "KGS", type: "CHECKING", name: "A", displayNumber: "0001" },
  });
  const b = await prisma.account.create({
    data: { userId: user.id, currency: "KGS", type: "CHECKING", name: "B", displayNumber: "0002" },
  });
  return { user, a, b };
}

describe("ledger integrity (integration)", () => {
  it("cached balances match the recomputed ledger for every account", async () => {
    if (!seeded) return;
    const accounts = await prisma.account.findMany({ select: { id: true, balanceCached: true } });
    expect(accounts.length).toBeGreaterThan(0);
    for (const acc of accounts) {
      const recomputed = await recomputeBalance(prisma, acc.id);
      expect(recomputed).toBe(acc.balanceCached);
    }
  });

  it("conserves value: ledger entries net to zero per currency", async () => {
    if (!seeded) return;
    const rows = await prisma.ledgerEntry.groupBy({
      by: ["currency", "direction"],
      _sum: { amount: true },
    });
    const net = new Map<string, bigint>();
    for (const r of rows) {
      const amt = r._sum.amount ?? 0n;
      net.set(r.currency, (net.get(r.currency) ?? 0n) + (r.direction === "CREDIT" ? amt : -amt));
    }
    for (const [, value] of net) expect(value).toBe(0n);
  });

  it("the audit hash-chain verifies", async () => {
    if (!seeded) return;
    const result = await verifyAuditChain();
    expect(result.ok).toBe(true);
  });
});

describe("transfer posting (integration)", () => {
  it("moves funds and keeps the ledger balanced", async () => {
    if (!seeded) return;
    const { user, a, b } = await makeUserWithAccounts();
    await prisma.$transaction((tx) => demoDeposit(tx, { accountId: a.id, amount: 100000n })); // 1000.00

    const result = await executeTransfer({
      userId: user.id,
      kind: TransferKind.OWN,
      fromAccountId: a.id,
      toAccountId: b.id,
      amount: 30000n, // 300.00
    });
    expect(result.fromBalanceAfter).toBe(70000n);
    expect(result.toBalanceAfter).toBe(30000n);

    expect(await recomputeBalance(prisma, a.id)).toBe(70000n);
    expect(await recomputeBalance(prisma, b.id)).toBe(30000n);
  });

  it("rejects insufficient funds and records a FAILED transaction", async () => {
    if (!seeded) return;
    const { user, a, b } = await makeUserWithAccounts();
    await prisma.$transaction((tx) => demoDeposit(tx, { accountId: a.id, amount: 5000n })); // 50.00

    await expect(
      executeTransfer({ userId: user.id, kind: TransferKind.OWN, fromAccountId: a.id, toAccountId: b.id, amount: 999999n }),
    ).rejects.toBeInstanceOf(AppError);

    const failed = await prisma.transaction.findFirst({
      where: { userId: user.id, status: "FAILED" },
    });
    expect(failed).not.toBeNull();
    // Balance untouched.
    expect(await recomputeBalance(prisma, a.id)).toBe(5000n);
  });
});

describe("idempotency (integration)", () => {
  it("never double-posts a transfer for the same key", async () => {
    if (!seeded) return;
    const { user, a, b } = await makeUserWithAccounts();
    await prisma.$transaction((tx) => demoDeposit(tx, { accountId: a.id, amount: 100000n }));

    const key = `it-key-${Date.now()}`;
    const body = { fromAccountId: a.id, toAccountId: b.id, amount: "250.00" };
    const run = () =>
      withIdempotency({ key, userId: user.id, endpoint: "test.transfer", body }, async () => {
        const r = await executeTransfer({
          userId: user.id, kind: TransferKind.OWN, fromAccountId: a.id, toAccountId: b.id, amount: 25000n,
        });
        return { status: 201, body: serializeBigInt(r), transactionId: r.transactionId };
      });

    const first = await run();
    const second = await run();
    expect(first.kind).toBe("ok");
    expect(second.kind).toBe("ok");
    if (second.kind === "ok") expect(second.replayed).toBe(true);

    const transfers = await prisma.transfer.count({ where: { userId: user.id } });
    expect(transfers).toBe(1); // exactly one, despite two calls
    expect(await recomputeBalance(prisma, b.id)).toBe(25000n);
  });
});
