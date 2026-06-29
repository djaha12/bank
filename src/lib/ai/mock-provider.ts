import { formatMoney } from "@/lib/money";
import { Currency } from "@prisma/client";
import {
  AiCompletionRequest,
  AiCompletionResult,
  AiProvider,
  CUSTOMER_DISCLAIMER,
  COMPLIANCE_DISCLAIMER,
} from "@/lib/ai/types";

/**
 * Deterministic mock LLM. It renders the structured grounding into a readable,
 * helpful narrative per skill. No external calls, no randomness — the same
 * inputs always produce the same output. Replace with a real provider that
 * accepts the same AiCompletionRequest to go live.
 */
export class MockAiProvider implements AiProvider {
  readonly name = "mock";

  async complete(req: AiCompletionRequest): Promise<AiCompletionResult> {
    const content = this.render(req);
    return { content, toolUsed: `mock:${req.skill}`, grounding: req.grounding };
  }

  private render(req: AiCompletionRequest): string {
    switch (req.skill) {
      case "spending":
        return this.spending(req);
      case "budget":
        return this.budget(req);
      case "fraud":
        return this.fraud(req);
      case "compliance":
        return this.compliance(req);
      default:
        return this.support(req);
    }
  }

  private spending(req: AiCompletionRequest): string {
    const g = req.grounding as {
      currency?: Currency;
      total?: string;
      categories?: { label: string; amount: string; pct: number }[];
    };
    const cur = g.currency ?? "KGS";
    const lines: string[] = [];
    lines.push(`Here's where your money went this period (in ${cur}):`);
    if (!g.categories?.length) {
      lines.push("• No spending recorded yet — once you make card payments I'll break them down by category.");
    } else {
      for (const c of g.categories.slice(0, 6)) {
        lines.push(`• ${c.label}: ${formatMoney(c.amount, cur)} (${c.pct}%)`);
      }
      const top = g.categories[0];
      if (top) {
        lines.push(
          `\nYour largest category is ${top.label}. If you wanted to trim spending, that's the first place to look.`,
        );
      }
    }
    return this.wrap(lines.join("\n"), CUSTOMER_DISCLAIMER);
  }

  private budget(req: AiCompletionRequest): string {
    const g = req.grounding as {
      currency?: Currency;
      suggested?: { label: string; amount: string }[];
      overBudget?: { name: string; spent: string; limit: string }[];
    };
    const cur = g.currency ?? "KGS";
    const lines: string[] = ["A simple monthly budget based on your recent activity:"];
    for (const s of g.suggested ?? []) {
      lines.push(`• ${s.label}: ${formatMoney(s.amount, cur)}`);
    }
    if (g.overBudget?.length) {
      lines.push("\n⚠️ You're over budget on:");
      for (const o of g.overBudget) {
        lines.push(`• ${o.name}: ${formatMoney(o.spent, cur)} of ${formatMoney(o.limit, cur)}`);
      }
    } else {
      lines.push("\n✅ You're within all current budgets — nice work.");
    }
    return this.wrap(lines.join("\n"), CUSTOMER_DISCLAIMER);
  }

  private fraud(req: AiCompletionRequest): string {
    const g = req.grounding as {
      transaction?: { amount: string; currency: Currency; merchant?: string };
      factors?: { rule: string; reason: string; level: string }[];
    };
    const lines: string[] = [];
    if (g.transaction) {
      lines.push(
        `About this ${formatMoney(g.transaction.amount, g.transaction.currency)} transaction${
          g.transaction.merchant ? ` at ${g.transaction.merchant}` : ""
        }:`,
      );
    }
    if (g.factors?.length) {
      lines.push("It was flagged because:");
      for (const f of g.factors) lines.push(`• [${f.level}] ${f.reason}`);
      lines.push("\nIf this was you, you can ignore the alert. If not, freeze your card and contact support.");
    } else {
      lines.push("No specific risk factors were detected for this item.");
    }
    return this.wrap(lines.join("\n"), CUSTOMER_DISCLAIMER);
  }

  private compliance(req: AiCompletionRequest): string {
    const g = req.grounding as {
      alert?: { ruleCode: string; level: string; reason: string };
      customer?: { riskLevel?: string; kycStatus?: string };
      suggestedSteps?: string[];
    };
    const lines: string[] = [];
    if (g.alert) {
      lines.push(`Alert summary: ${g.alert.ruleCode} (${g.alert.level}).`);
      lines.push(`Reason: ${g.alert.reason}`);
    }
    if (g.customer) {
      lines.push(`Customer risk: ${g.customer.riskLevel ?? "n/a"}, KYC: ${g.customer.kycStatus ?? "n/a"}.`);
    }
    lines.push("\nSuggested next steps:");
    for (const s of g.suggestedSteps ?? ["Review linked transactions", "Check customer KYC", "Document a decision"]) {
      lines.push(`• ${s}`);
    }
    return this.wrap(lines.join("\n"), COMPLIANCE_DISCLAIMER);
  }

  private support(req: AiCompletionRequest): string {
    const msg = req.userMessage.toLowerCase();
    let body: string;
    if (/evade|avoid kyc|hide|launder|sanction|bypass/.test(msg)) {
      body =
        "I can't help with that. NEO BANK OS follows KYC/AML rules and I won't assist with hiding funds, " +
        "evading verification, or bypassing sanctions.";
    } else if (/freeze|lost|stolen|fraud/.test(msg)) {
      body =
        "To protect a card, open Cards → select the card → Freeze. You can unfreeze anytime. " +
        "For suspicious activity, also review Security → Login history.";
    } else if (/transfer|send money|payment/.test(msg)) {
      body =
        "To send money: Transfers → choose Own / P2P / Bank → pick the account, enter the amount, and confirm. " +
        "Each transfer shows the fee and a receipt.";
    } else if (/save|saving|goal|vault/.test(msg)) {
      body =
        "Open Savings to create a vault with a target. You can enable round-ups or a recurring auto-save rule.";
    } else {
      body =
        "I'm your in-app assistant. I can explain your spending, suggest a budget, walk you through transfers " +
        "and cards, or help with savings goals. What would you like to do?";
    }
    return this.wrap(body, CUSTOMER_DISCLAIMER);
  }

  private wrap(body: string, disclaimer: string): string {
    return `${body}\n\n— ${disclaimer}`;
  }
}
