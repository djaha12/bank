import { route, ok, parseBody, enforceRateLimit } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { aiChatSchema } from "@/lib/validation";
import { chat } from "@/lib/ai/service";
import { serializeBigInt } from "@/lib/money";

export const POST = route(async (req) => {
  const user = await requireUser();
  enforceRateLimit(req, "ai", { max: 20, windowMs: 60000 }, user.id);
  const body = await parseBody(req, aiChatSchema);

  const result = await chat({
    userId: user.id,
    conversationId: body.conversationId,
    message: body.message,
  });

  return ok(serializeBigInt(result));
});
