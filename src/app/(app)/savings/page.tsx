import { PiggyBank } from "lucide-react";
import { Currency, SavingsGoalStatus } from "@prisma/client";
import { requirePageUser } from "@/lib/page-auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/brand/page-header";
import { SavingsClient, type SavingsGoalVM, type AccountVM } from "./SavingsClient";

interface AutoSaveRule {
  roundUp?: boolean;
  recurring?: boolean;
  recurringAmount?: string;
}

function parseRule(raw: unknown): AutoSaveRule {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const r = raw as Record<string, unknown>;
    return {
      roundUp: typeof r.roundUp === "boolean" ? r.roundUp : false,
      recurring: typeof r.recurring === "boolean" ? r.recurring : false,
      recurringAmount:
        typeof r.recurringAmount === "string" ? r.recurringAmount : undefined,
    };
  }
  return { roundUp: false, recurring: false };
}

export default async function SavingsPage() {
  const user = await requirePageUser();

  const [goals, accounts] = await Promise.all([
    prisma.savingsGoal.findMany({
      where: { userId: user.id, status: { not: SavingsGoalStatus.ARCHIVED } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.account.findMany({
      where: { userId: user.id, deletedAt: null, ownerType: "USER" },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, currency: true, displayNumber: true },
    }),
  ]);

  const goalVMs: SavingsGoalVM[] = goals.map((g) => {
    const rule = parseRule(g.autoSaveRule);
    return {
      id: g.id,
      name: g.name,
      currency: g.currency,
      targetAmount: g.targetAmount.toString(),
      currentAmount: g.currentAmount.toString(),
      status: g.status,
      color: g.color,
      targetDate: g.targetDate ? g.targetDate.toISOString() : null,
      roundUp: rule.roundUp ?? false,
      recurring: rule.recurring ?? false,
      recurringAmount: rule.recurringAmount ?? null,
    };
  });

  const accountVMs: AccountVM[] = accounts.map((a) => ({
    id: a.id,
    name: a.name,
    currency: a.currency as Currency,
    displayNumber: a.displayNumber,
  }));

  const defaultCurrency: Currency = accountVMs[0]?.currency ?? "KGS";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Savings"
        description="Set goals, automate the saving, and watch your vaults grow."
        actions={
          <span className="hidden items-center gap-2 text-sm text-muted-foreground sm:inline-flex">
            <PiggyBank className="h-4 w-4 text-primary" />
            {goalVMs.length} active {goalVMs.length === 1 ? "vault" : "vaults"}
          </span>
        }
      />
      <SavingsClient
        initialGoals={goalVMs}
        accounts={accountVMs}
        defaultCurrency={defaultCurrency}
      />
    </div>
  );
}
