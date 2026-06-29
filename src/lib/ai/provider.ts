import type { AiProvider } from "@/lib/ai/types";
import { MockAiProvider } from "@/lib/ai/mock-provider";

/**
 * Provider factory. `AI_PROVIDER` selects the implementation. Only "mock"
 * ships by default (no API key). To go live, implement an adapter that
 * satisfies AiProvider (call the real LLM with the same request shape) and
 * register it here — nothing else in the app changes.
 */
let cached: AiProvider | null = null;

export function getAiProvider(): AiProvider {
  if (cached) return cached;
  const name = (process.env.AI_PROVIDER ?? "mock").toLowerCase();
  switch (name) {
    case "mock":
      cached = new MockAiProvider();
      break;
    // case "openai":   cached = new OpenAiProvider(process.env.AI_API_KEY!); break;
    // case "anthropic": cached = new AnthropicProvider(process.env.AI_API_KEY!); break;
    // case "gemini":   cached = new GeminiProvider(process.env.AI_API_KEY!); break;
    default:
      // Fail safe to mock rather than crash; log once.
      // eslint-disable-next-line no-console
      console.warn(`[ai] AI_PROVIDER="${name}" not implemented, falling back to mock`);
      cached = new MockAiProvider();
  }
  return cached;
}
