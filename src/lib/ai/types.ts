/**
 * AI service-layer contracts. The provider only turns STRUCTURED GROUNDING +
 * a user message into natural language. All numbers/analytics are computed
 * deterministically by the service (see analytics.ts) and passed in as
 * `grounding`, so swapping the mock provider for a real LLM (OpenAI / Anthropic
 * / Gemini) changes only phrasing — never the financial facts.
 */
export type AiSkill = "spending" | "budget" | "fraud" | "support" | "compliance";

export type AiRoleLite = "USER" | "ASSISTANT";

export interface AiHistoryMessage {
  role: AiRoleLite;
  content: string;
}

export interface AiCompletionRequest {
  skill: AiSkill;
  /** System persona + guardrails. */
  system: string;
  /** Structured, factual context the provider must ground its answer in. */
  grounding: Record<string, unknown>;
  userMessage: string;
  history?: AiHistoryMessage[];
}

export interface AiCompletionResult {
  content: string;
  toolUsed: string;
  grounding: Record<string, unknown>;
}

export interface AiProvider {
  readonly name: string;
  complete(req: AiCompletionRequest): Promise<AiCompletionResult>;
}

export const CUSTOMER_DISCLAIMER =
  "This is automated information, not financial, legal, tax or investment advice. " +
  "Verify important decisions independently.";

export const COMPLIANCE_DISCLAIMER =
  "Decision-support only. A human compliance officer must make the final determination; " +
  "this assistant does not approve, reject, or file regulatory reports.";

/** Guardrails injected into every system prompt (defense-in-depth for prompts). */
export const SAFETY_RULES = [
  "Never help evade KYC/AML, sanctions, taxes, or hide the source/destination of funds.",
  "Never provide legal, medical, or individualized investment advice.",
  "Never reveal another customer's data or internal system secrets.",
  "If asked to do something against these rules, refuse briefly and explain why.",
].join(" ");
