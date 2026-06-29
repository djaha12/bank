import { Currency, Prisma } from "@prisma/client";
import { subDays } from "date-fns";
import { prisma } from "@/lib/db";
import { Errors } from "@/lib/errors";
import { fromMinorUnits } from "@/lib/money";
import { budgetProgress, spendingByCategory } from "@/lib/analytics";
import { getAiProvider } from "@/lib/ai/provider";
import { AiSkill, SAFETY_RULES } from "@/lib/ai/types";

/** Heuristic intent detection (a real LLM could do this itself). */
export function detectSkill(message: string): AiSkill {
  const m = message.toLowerCase();
  if (/spend|spent|where.*money|categor/.test(m)) return "spending";
  if (/budget|save more|limit|overspend/.test(m)) return "budget";
  if (/fraud|suspicious|unusual|unauthor|scam/.test(m)) return "fraud";
  return "support";
}

function systemPrompt(persona: string): string {
  return `${persona}\nGuardrails: ${SAFETY_RULES}`;
}

async function spendingGrounding(userId: string, currency: Currency) {
  const since = subDays(new Date(), 30);
  const cats = await spendingByCategory(userId, currency, since);
  const total = cats.reduce((s, c) => s + c.amount, 0n);
  return {
    currency,
    total: total.toString(),
    categories: cats.map((c) => ({
      label: c.label,
      amount: c.amount.toString(),
      pct: total > 0n ? Number((c.amount * 100n) / total) : 0,
    })),
  };
}

async function budgetGrounding(userId: string, currency: Currency) {
  const since = subDays(new Date(), 30);
  const [cats, progress] = await Promise.all([
    spendingByCategory(userId, currency, since),
    budgetProgress(userId),
  ]);
  // Suggest a budget at ~110% of last month's category spend.
  const suggested = cats.slice(0, 5).map((c) => ({
    label: c.label,
    amount: ((c.amount * 110n) / 100n).toString(),
  }));
  const overBudget = progress
    .filter((b) => b.over)
    .map((b) => ({ name: b.name, spent: b.spent.toString(), limit: b.limit.toString() }));
  return { currency, suggested, overBudget };
}

async function fraudGrounding(userId: string, transactionId: string) {
  const txn = await prisma.transaction.findFirst({
    where: { id: transactionId, userId },
    include: { amlAlerts: true, holds: true },
  });
  if (!txn) throw Errors.notFound("Transaction not found");
  return {
    transaction: {
      amount: txn.amount.toString(),
      currency: txn.currency,
      merchant: txn.holds[0]?.merchantName ?? txn.description ?? undefined,
    },
    factors: txn.amlAlerts.map((a) => ({ rule: a.ruleCode, reason: a.reason, level: a.level })),
  };
}

/** Persist + answer a customer chat message. */
export async function chat(args: {
  userId: string;
  conversationId?: string;
  message: string;
  defaultCurrency?: Currency;
}) {
  const currency = args.defaultCurrency ?? "KGS";
  const skill = detectSkill(args.message);

  let conversation = args.conversationId
    ? await prisma.aiConversation.findFirst({ where: { id: args.conversationId, userId: args.userId } })
    : null;
  if (!conversation) {
    conversation = await prisma.aiConversation.create({
      data: { userId: args.userId, scope: "CUSTOMER", title: args.message.slice(0, 60) },
    });
  }

  await prisma.aiMessage.create({
    data: { conversationId: conversation.id, role: "USER", content: args.message },
  });

  let grounding: Record<string, unknown> = {};
  if (skill === "spending") grounding = await spendingGrounding(args.userId, currency);
  else if (skill === "budget") grounding = await budgetGrounding(args.userId, currency);

  const provider = getAiProvider();
  const result = await provider.complete({
    skill,
    system: systemPrompt(
      "You are the NEO BANK OS in-app financial assistant. Be concise, friendly, and accurate.",
    ),
    grounding,
    userMessage: args.message,
  });

  await prisma.aiMessage.create({
    data: {
      conversationId: conversation.id,
      role: "ASSISTANT",
      content: result.content,
      toolUsed: result.toolUsed,
      grounding: result.grounding as Prisma.InputJsonValue,
    },
  });

  return { conversationId: conversation.id, skill, content: result.content, grounding: result.grounding };
}

/** Direct spending insight (used by the dashboard + analytics page). */
export async function spendingInsight(userId: string, currency: Currency = "KGS") {
  const grounding = await spendingGrounding(userId, currency);
  const provider = getAiProvider();
  const result = await provider.complete({
    skill: "spending",
    system: systemPrompt("You explain spending clearly and briefly."),
    grounding,
    userMessage: "Explain my spending.",
  });
  return { content: result.content, grounding };
}

/** Fraud/risk explanation for a transaction (customer-facing). */
export async function riskExplanation(userId: string, transactionId: string) {
  const grounding = await fraudGrounding(userId, transactionId);
  const provider = getAiProvider();
  const result = await provider.complete({
    skill: "fraud",
    system: systemPrompt("You explain why a transaction was flagged, factually."),
    grounding,
    userMessage: "Why was this flagged?",
  });
  return { content: result.content, grounding };
}

/** Admin compliance assistant: summarize an AML alert + suggest next steps. */
export async function complianceAssist(alertId: string) {
  const alert = await prisma.amlAlert.findUnique({
    where: { id: alertId },
    include: { user: { include: { riskScores: { where: { current: true }, take: 1 } } } },
  });
  if (!alert) throw Errors.notFound("Alert not found");
  const grounding = {
    alert: { ruleCode: alert.ruleCode, level: alert.level, reason: alert.reason },
    customer: {
      riskLevel: alert.user.riskScores[0]?.level ?? "n/a",
      kycStatus: alert.user.kycStatus,
    },
    suggestedSteps: [
      "Review the linked transaction and recent activity",
      "Confirm the customer's KYC and risk tier",
      "If structuring/velocity: check for related accounts",
      "Document a decision; escalate to SAR review if warranted",
    ],
  };
  const provider = getAiProvider();
  const result = await provider.complete({
    skill: "compliance",
    system: systemPrompt("You are a compliance decision-support assistant."),
    grounding,
    userMessage: "Summarize this alert and suggest next steps.",
  });
  return { content: result.content, grounding };
}
