import { describe, it, expect, beforeAll } from "vitest";
import { prisma } from "@/lib/db";
import { demoDeposit } from "@/lib/operations/deposit";
import { executeTransfer } from "@/lib/operations/transfers";
import { simulateCardPurchase } from "@/lib/operations/cards";
import { TransferKind } from "@prisma/client";

/**
 * Regression tests for the audit-fixed risk-ordering bugs: the rules must
 * actually FIRE now that risk is evaluated on pre-transaction state. Require a
 * seeded DB (system accounts).
 */
let seeded = false;

beforeAll(async () => {
  const funding = await prisma.account
    .findFirst({ where: { ownerType: "SYSTEM", systemKind: "FUNDING", currency: "KGS" } })
    .catch(() => null);
  seeded = Boolean(funding);
});

async function approvedUserWithKgs() {
  const email = `risk-${Date.now()}-${Math.random().toString(36).slice(2)}@test.local`;
  const user = await prisma.user.create({ data: { email, status: "ACTIVE", kycStatus: "APPROVED" } });
  const a = await prisma.account.create({
    data: { userId: user.id, currency: "KGS", type: "CHECKING", name: "A", displayNumber: "0001" },
  });
  const b = await prisma.account.create({
    data: { userId: user.id, currency: "KGS", type: "CHECKING", name: "B", displayNumber: "0002" },
  });
  await prisma.$transaction((tx) => demoDeposit(tx, { accountId: a.id, amount: 100_000_00n })); // 100,000.00
  return { user, a, b };
}

describe("risk engine ordering regressions", () => {
  it("ABOVE_NORMAL_BEHAVIOR fires when a transfer dwarfs the recent average", async () => {
    if (!seeded) return;
    const { user, a, b } = await approvedUserWithKgs();
    // Build a baseline of small transfers (avg ~ 100.00).
    for (let i = 0; i < 6; i++) {
      await executeTransfer({ userId: user.id, kind: TransferKind.OWN, fromAccountId: a.id, toAccountId: b.id, amount: 10_000n });
    }
    // A transfer >5x the average but BELOW the large-transaction threshold.
    await executeTransfer({ userId: user.id, kind: TransferKind.OWN, fromAccountId: a.id, toAccountId: b.id, amount: 60_000n });

    const alert = await prisma.amlAlert.findFirst({
      where: { userId: user.id, ruleCode: "ABOVE_NORMAL_BEHAVIOR" },
    });
    expect(alert).not.toBeNull();
  });

  it("UNUSUAL_MERCHANT fires on a genuine first-time merchant category", async () => {
    if (!seeded) return;
    const { user, a } = await approvedUserWithKgs();
    const card = await prisma.card.create({
      data: {
        userId: user.id, accountId: a.id, last4: "4242", tokenRef: `tok_${Math.random().toString(36).slice(2)}`,
        expMonth: 12, expYear: new Date().getFullYear() + 3, cardholderName: "RISK TEST",
      },
    });
    await simulateCardPurchase({
      userId: user.id, cardId: card.id, amount: 5_000n, merchantName: "Brand New Shop", mcc: "5999", capture: true,
    });
    const alert = await prisma.amlAlert.findFirst({
      where: { userId: user.id, ruleCode: "UNUSUAL_MERCHANT" },
    });
    expect(alert).not.toBeNull();
  });
});
