import { describe, it, expect, beforeAll } from "vitest";
import { prisma } from "@/lib/db";
import { demoDeposit } from "@/lib/operations/deposit";
import { simulateCardPurchase } from "@/lib/operations/cards";
import { captureHold, releaseHold } from "@/lib/operations/holds";
import { recomputeBalance } from "@/lib/ledger";

let seeded = false;
beforeAll(async () => {
  const f = await prisma.account.findFirst({ where: { ownerType: "SYSTEM", systemKind: "CARD_SCHEME", currency: "KGS" } }).catch(() => null);
  seeded = Boolean(f);
});

async function userWithCard() {
  const email = `hold-${Date.now()}-${Math.random().toString(36).slice(2)}@test.local`;
  const user = await prisma.user.create({ data: { email, status: "ACTIVE", kycStatus: "APPROVED" } });
  const acc = await prisma.account.create({
    data: { userId: user.id, currency: "KGS", type: "CHECKING", name: "A", displayNumber: "0001" },
  });
  await prisma.$transaction((tx) => demoDeposit(tx, { accountId: acc.id, amount: 100_000_00n }));
  const card = await prisma.card.create({
    data: { userId: user.id, accountId: acc.id, last4: "4242", tokenRef: `tok_${Math.random().toString(36).slice(2)}`, expMonth: 12, expYear: new Date().getFullYear() + 3, cardholderName: "HOLD TEST" },
  });
  return { user, acc, card };
}

describe("card hold lifecycle (integration)", () => {
  it("authorization places a hold; capture settles it (balance down, hold freed)", async () => {
    if (!seeded) return;
    const { user, acc, card } = await userWithCard();
    const before = await prisma.account.findUnique({ where: { id: acc.id } });

    const auth = await simulateCardPurchase({
      userId: user.id, cardId: card.id, amount: 2_500_00n, merchantName: "Hold Shop", mcc: "5999", capture: false,
    });
    expect(auth.status).toBe("PENDING");
    const held = await prisma.account.findUnique({ where: { id: acc.id } });
    // Balance unchanged, but hold earmarked -> available reduced.
    expect(held!.balanceCached).toBe(before!.balanceCached);
    expect(held!.holdTotal).toBe(2_500_00n);

    const hold = await prisma.hold.findFirst({ where: { cardId: card.id, status: "HELD" } });
    await captureHold({ holdId: hold!.id });

    const after = await prisma.account.findUnique({ where: { id: acc.id } });
    expect(after!.balanceCached).toBe(before!.balanceCached - 2_500_00n); // real debit now
    expect(after!.holdTotal).toBe(0n); // earmark released
    expect(await recomputeBalance(prisma, acc.id)).toBe(after!.balanceCached);
    const captured = await prisma.hold.findUnique({ where: { id: hold!.id } });
    expect(captured!.status).toBe("CAPTURED");
  });

  it("release voids an authorization (funds freed, no ledger movement)", async () => {
    if (!seeded) return;
    const { user, acc, card } = await userWithCard();
    const before = await prisma.account.findUnique({ where: { id: acc.id } });

    await simulateCardPurchase({
      userId: user.id, cardId: card.id, amount: 1_000_00n, merchantName: "Void Shop", mcc: "5999", capture: false,
    });
    const hold = await prisma.hold.findFirst({ where: { cardId: card.id, status: "HELD" } });
    await releaseHold({ holdId: hold!.id, reason: "test" });

    const after = await prisma.account.findUnique({ where: { id: acc.id } });
    expect(after!.balanceCached).toBe(before!.balanceCached); // untouched
    expect(after!.holdTotal).toBe(0n); // freed
    const released = await prisma.hold.findUnique({ where: { id: hold!.id } });
    expect(released!.status).toBe("RELEASED");
  });

  it("cannot capture an already-settled hold", async () => {
    if (!seeded) return;
    const { user, acc, card } = await userWithCard();
    void acc;
    await simulateCardPurchase({
      userId: user.id, cardId: card.id, amount: 500_00n, merchantName: "Double", mcc: "5999", capture: false,
    });
    const hold = await prisma.hold.findFirst({ where: { cardId: card.id, status: "HELD" } });
    await captureHold({ holdId: hold!.id });
    await expect(captureHold({ holdId: hold!.id })).rejects.toThrow();
  });
});
