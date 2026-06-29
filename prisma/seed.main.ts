/**
 * NEO BANK OS 2026 — demo seed (SANDBOX ONLY).
 *
 * Creates reference data, system ledger accounts, RBAC, 3 admins and 5 demo
 * customers (1 rich approved, 2 approved, 1 pending, 1 rejected). All money is
 * minted through the SYSTEM FUNDING account via demoDeposit so the global
 * double-entry ledger stays balanced. Demo credentials are LOCAL-ONLY.
 *
 * Uses relative imports (tsx does not resolve tsconfig path aliases).
 */
import {
  PrismaClient,
  Currency,
  SystemAccountKind,
  TransferKind,
  KycStatus,
} from "@prisma/client";
import { hashPassword } from "../src/lib/crypto";
import { demoDeposit } from "../src/lib/operations/deposit";
import { executeTransfer } from "../src/lib/operations/transfers";
import { simulateCardPurchase } from "../src/lib/operations/cards";
import { PERMISSIONS, ROLE_DEFINITIONS } from "../src/lib/rbac";
import { SYSTEM_ACCOUNT_MATRIX } from "../src/lib/system-accounts";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "Password123!";
const ADMIN_PASSWORD = "Admin123!";
const C = (n: number) => BigInt(Math.round(n * 100)); // major -> minor units

function last4() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

async function truncateAll() {
  const tables = [
    "AiMessage", "AiConversation", "Notification", "Dispute", "AmlAlert", "RiskScore",
    "SanctionsScreeningResult", "Hold", "LedgerEntry", "Transfer", "Transaction",
    "MerchantControl", "CardLimit", "Card", "Budget", "SavingsGoal", "KycDocument",
    "KycApplication", "DeviceSession", "LoginEvent", "WebAuthnCredential", "OtpChallenge",
    "IdempotencyKey", "AuditLog", "Account", "CustomerProfile", "AdminUserRole",
    "RolePermission", "User", "AdminUser", "Role", "Permission", "SpendingCategory",
    "FeeRule", "FxRate", "WebhookEvent",
  ];
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${tables.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE;`,
  );
}

async function seedReference() {
  // Spending categories (mcc prefixes are sandbox approximations).
  const categories = [
    { key: "groceries", label: "Groceries", color: "#10b981", mccPrefixes: ["54", "5411"] },
    { key: "dining", label: "Dining", color: "#f59e0b", mccPrefixes: ["58", "5812", "5814"] },
    { key: "transport", label: "Transport", color: "#38bdf8", mccPrefixes: ["41", "4111", "4121", "5541"] },
    { key: "shopping", label: "Shopping", color: "#a855f7", mccPrefixes: ["56", "5651", "5999"] },
    { key: "entertainment", label: "Entertainment", color: "#ef4444", mccPrefixes: ["79", "7832", "7995"] },
    { key: "utilities", label: "Utilities", color: "#6366f1", mccPrefixes: ["48", "4900"] },
    { key: "health", label: "Health", color: "#14b8a6", mccPrefixes: ["80", "8011", "5912"] },
    { key: "travel", label: "Travel", color: "#0ea5e9", mccPrefixes: ["45", "4511", "7011"] },
  ];
  for (const c of categories) await prisma.spendingCategory.create({ data: c });

  // Fee rules (modest sandbox fees).
  const fees = [
    { key: "transfer.internal", description: "Internal transfer", type: "INTERNAL_TRANSFER" as const, flatAmount: 0n, bps: 0 },
    { key: "transfer.p2p", description: "P2P transfer", type: "P2P_TRANSFER" as const, flatAmount: 0n, bps: 0 },
    { key: "transfer.bank", description: "Bank transfer (sandbox)", type: "INTERNAL_TRANSFER" as const, flatAmount: 0n, bps: 10 },
    { key: "fx.spread", description: "FX handling fee", type: "FX_CONVERSION" as const, flatAmount: 0n, bps: 20 },
    { key: "card.purchase", description: "Card purchase", type: "CARD_CAPTURE" as const, flatAmount: 0n, bps: 0 },
  ];
  for (const f of fees) await prisma.feeRule.create({ data: f });

  // FX rates (scaled by 1e8). Mid-market, sandbox values.
  const scale = 100_000_000;
  const rate = (base: Currency, quote: Currency, r: number) => ({
    baseCurrency: base, quoteCurrency: quote, rateScaled: BigInt(Math.round(r * scale)), scale, spreadBps: 50,
  });
  const rates = [
    rate("USD", "KGS", 89.0), rate("KGS", "USD", 1 / 89.0),
    rate("EUR", "KGS", 96.0), rate("KGS", "EUR", 1 / 96.0),
    rate("USD", "EUR", 0.92), rate("EUR", "USD", 1 / 0.92),
  ];
  for (const r of rates) await prisma.fxRate.create({ data: r });

  // RBAC: permissions, roles, links.
  const permKeys = Object.values(PERMISSIONS);
  const permIds = new Map<string, string>();
  for (const key of permKeys) {
    const p = await prisma.permission.create({ data: { key, description: key } });
    permIds.set(key, p.id);
  }
  const roleIds = new Map<string, string>();
  for (const [key, def] of Object.entries(ROLE_DEFINITIONS)) {
    const role = await prisma.role.create({ data: { key, name: def.name, description: def.description } });
    roleIds.set(key, role.id);
    for (const perm of def.permissions) {
      await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: permIds.get(perm)! } });
    }
  }

  // System ledger accounts (per kind x currency).
  for (const { kind, currencies } of SYSTEM_ACCOUNT_MATRIX) {
    for (const currency of currencies) {
      await prisma.account.create({
        data: {
          ownerType: "SYSTEM",
          systemKind: kind as SystemAccountKind,
          type: "SYSTEM",
          currency,
          name: `${kind} ${currency}`,
          displayNumber: "SYSTEM",
        },
      });
    }
  }

  return { roleIds };
}

async function seedAdmins(roleIds: Map<string, string>) {
  const admins = [
    { email: "admin@neobank.local", firstName: "Sasha", lastName: "Root", role: "super_admin" },
    { email: "compliance@neobank.local", firstName: "Mira", lastName: "Khan", role: "compliance_officer" },
    { email: "support@neobank.local", firstName: "Deniz", lastName: "Orozov", role: "support_agent" },
  ];
  for (const a of admins) {
    const admin = await prisma.adminUser.create({
      data: { email: a.email, firstName: a.firstName, lastName: a.lastName, passwordHash: hashPassword(ADMIN_PASSWORD) },
    });
    await prisma.adminUserRole.create({ data: { adminUserId: admin.id, roleId: roleIds.get(a.role)! } });
  }
}

async function createApprovedCustomer(opts: {
  email: string; firstName: string; lastName: string; country: string;
  balances: { KGS: number; USD: number; EUR: number };
}) {
  const user = await prisma.user.create({
    data: {
      email: opts.email,
      passwordHash: hashPassword(DEMO_PASSWORD),
      emailVerified: true,
      kycStatus: KycStatus.APPROVED,
      profile: {
        create: {
          firstName: opts.firstName, lastName: opts.lastName, country: opts.country,
          nationality: opts.country, city: "Bishkek", addressLine1: "1 Demo Street",
          postalCode: "720001", occupation: "Engineer", sourceOfFunds: "SALARY",
        },
      },
      kycApplications: {
        create: { status: KycStatus.APPROVED, sourceOfFunds: "SALARY", submittedAt: new Date(), decidedAt: new Date() },
      },
    },
  });

  // Accounts per currency.
  const accounts: Record<Currency, string> = {} as Record<Currency, string>;
  for (const currency of ["KGS", "USD", "EUR"] as Currency[]) {
    const acc = await prisma.account.create({
      data: { userId: user.id, currency, type: "CHECKING", name: `${currency} account`, displayNumber: last4() },
    });
    accounts[currency] = acc.id;
  }

  // Mint demo balances through the FUNDING system account (balanced ledger).
  for (const currency of ["KGS", "USD", "EUR"] as Currency[]) {
    const amount = C(opts.balances[currency]);
    if (amount > 0n) {
      await prisma.$transaction((tx) => demoDeposit(tx, { accountId: accounts[currency], amount }));
    }
  }

  return { user, accounts };
}

async function seedDemoActivity(user: { id: string }, accounts: Record<Currency, string>) {
  // A virtual card on the KGS account.
  const card = await prisma.card.create({
    data: {
      userId: user.id, accountId: accounts.KGS, last4: last4(), tokenRef: `tok_${Math.random().toString(36).slice(2)}`,
      expMonth: 11, expYear: new Date().getFullYear() + 4, cardholderName: "DEMO USER",
      limit: { create: { dailyLimit: C(5000), monthlyLimit: C(50000), perTxLimit: C(2000), atmDailyLimit: C(1000) } },
      merchantControls: { create: [{ mcc: "7995", label: "Gambling", blocked: true }] },
    },
  });

  // Card purchases across categories (creates holds + ledger captures).
  const purchases = [
    { merchant: "Globus Market", mcc: "5411", amount: 1850 },
    { merchant: "Sierra Coffee", mcc: "5812", amount: 320 },
    { merchant: "Yandex Go", mcc: "4121", amount: 240 },
    { merchant: "TSUM Mall", mcc: "5651", amount: 2990 },
    { merchant: "Netflix", mcc: "7832", amount: 599 },
    { merchant: "MegaCom", mcc: "4900", amount: 500 },
  ];
  for (const p of purchases) {
    await simulateCardPurchase({
      userId: user.id, cardId: card.id, amount: C(p.amount), merchantName: p.merchant, mcc: p.mcc, capture: true,
    }).catch(() => undefined);
  }

  // A couple of transfers (own KGS->USD would be FX; do an own KGS internal to savings-like flow via P2P off, keep simple: an internal own transfer requires 2 accounts same currency — skip; do a bank transfer).
  await executeTransfer({
    userId: user.id, kind: TransferKind.BANK, fromAccountId: accounts.KGS, amount: C(1200),
    counterparty: { name: "Landlord", bank: "Demo Bank", country: "KG" }, note: "Rent",
  }).catch(() => undefined);

  // Budgets.
  const grocery = await prisma.spendingCategory.findUnique({ where: { key: "groceries" } });
  await prisma.budget.create({
    data: { userId: user.id, name: "Groceries", currency: "KGS", limitAmount: C(8000), categoryId: grocery?.id, spentCached: C(1850) },
  });
  await prisma.budget.create({
    data: { userId: user.id, name: "Dining out", currency: "KGS", limitAmount: C(3000), spentCached: C(320) },
  });

  // Savings goals.
  await prisma.savingsGoal.create({
    data: { userId: user.id, name: "Emergency fund", currency: "KGS", targetAmount: C(100000), currentAmount: C(35000), color: "#10b981", autoSaveRule: { type: "ROUNDUP" } },
  });
  await prisma.savingsGoal.create({
    data: { userId: user.id, name: "Trip to Issyk-Kul", currency: "USD", targetAmount: C(1500), currentAmount: C(400), color: "#38bdf8" },
  });

  // An AI conversation.
  const convo = await prisma.aiConversation.create({
    data: { userId: user.id, scope: "CUSTOMER", title: "Explain my spending" },
  });
  await prisma.aiMessage.createMany({
    data: [
      { conversationId: convo.id, role: "USER", content: "Explain my spending this month" },
      { conversationId: convo.id, role: "ASSISTANT", content: "Your largest category is Shopping. — Not financial advice.", toolUsed: "mock:spending" },
    ],
  });

  // Backdate a few captures to populate multi-month cashflow (keeps ledger sums intact).
  const caps = await prisma.transaction.findMany({
    where: { userId: user.id, type: "CARD_CAPTURE" }, take: 3, orderBy: { createdAt: "asc" },
  });
  let monthsBack = 1;
  for (const t of caps) {
    const d = new Date();
    d.setMonth(d.getMonth() - monthsBack);
    await prisma.transaction.update({ where: { id: t.id }, data: { createdAt: d } });
    await prisma.ledgerEntry.updateMany({ where: { transactionId: t.id }, data: { createdAt: d } });
    monthsBack += 1;
  }
}

async function seedPendingCustomer() {
  const user = await prisma.user.create({
    data: {
      email: "pending@neobank.local", passwordHash: hashPassword(DEMO_PASSWORD), kycStatus: KycStatus.IN_REVIEW,
      profile: { create: { firstName: "Aigerim", lastName: "Pending", country: "KG", city: "Osh", occupation: "Designer", sourceOfFunds: "BUSINESS" } },
      kycApplications: {
        create: {
          status: KycStatus.IN_REVIEW, sourceOfFunds: "BUSINESS", submittedAt: new Date(),
          documents: { create: [{ type: "PASSPORT", storageRef: "sandbox://passport", fileName: "passport.jpg" }, { type: "SELFIE", storageRef: "sandbox://selfie" }] },
        },
      },
    },
  });
  return user;
}

async function seedRejectedCustomer() {
  await prisma.user.create({
    data: {
      email: "rejected@neobank.local", passwordHash: hashPassword(DEMO_PASSWORD), kycStatus: KycStatus.REJECTED,
      profile: { create: { firstName: "Boris", lastName: "Rejected", country: "KG", occupation: "Trader", sourceOfFunds: "OTHER" } },
      kycApplications: {
        create: { status: KycStatus.REJECTED, sourceOfFunds: "OTHER", submittedAt: new Date(), decidedAt: new Date(), rejectionReason: "Document quality insufficient (sandbox demo)" },
      },
    },
  });
}

async function main() {
  console.info("⏳ Seeding NEO BANK OS 2026 (sandbox)…");
  await truncateAll();
  const { roleIds } = await seedReference();
  await seedAdmins(roleIds);

  // 1 rich approved demo customer.
  const demo = await createApprovedCustomer({
    email: "demo@neobank.local", firstName: "Demo", lastName: "User", country: "KG",
    balances: { KGS: 250000, USD: 3200, EUR: 1500 },
  });
  await seedDemoActivity(demo.user, demo.accounts);

  // 2 more approved customers with lighter activity.
  const c2 = await createApprovedCustomer({
    email: "nuray@neobank.local", firstName: "Nuray", lastName: "Asanova", country: "KG",
    balances: { KGS: 80000, USD: 500, EUR: 0 },
  });
  await simulateCardPurchase({
    userId: c2.user.id, cardId: (await prisma.card.create({
      data: { userId: c2.user.id, accountId: c2.accounts.KGS, last4: last4(), tokenRef: `tok_${Math.random().toString(36).slice(2)}`, expMonth: 6, expYear: new Date().getFullYear() + 3, cardholderName: "NURAY ASANOVA", limit: { create: { dailyLimit: C(3000), monthlyLimit: C(20000), perTxLimit: C(1500), atmDailyLimit: C(800) } } },
    })).id,
    amount: C(1200), merchantName: "Bookstore", mcc: "5942", capture: true,
  }).catch(() => undefined);

  const c3 = await createApprovedCustomer({
    email: "tilek@neobank.local", firstName: "Tilek", lastName: "Bekov", country: "KG",
    balances: { KGS: 1200000, USD: 15000, EUR: 9000 },
  });
  // Trigger a large-transaction AML alert.
  await executeTransfer({
    userId: c3.user.id, kind: TransferKind.BANK, fromAccountId: c3.accounts.KGS, amount: C(1100000),
    counterparty: { name: "Property LLC", bank: "Demo Bank", country: "KG" }, note: "Apartment",
  }).catch(() => undefined);

  await seedPendingCustomer();
  await seedRejectedCustomer();

  const counts = {
    users: await prisma.user.count(),
    admins: await prisma.adminUser.count(),
    accounts: await prisma.account.count(),
    transactions: await prisma.transaction.count(),
    ledgerEntries: await prisma.ledgerEntry.count(),
    alerts: await prisma.amlAlert.count(),
  };
  console.info("✅ Seed complete:", counts);
  console.info("   Customer demo login: demo@neobank.local /", DEMO_PASSWORD, "(LOCAL-ONLY)");
  console.info("   Admin login: admin@neobank.local /", ADMIN_PASSWORD, "(LOCAL-ONLY)");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
