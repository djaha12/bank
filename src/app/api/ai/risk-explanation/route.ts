import { z } from "zod";
import { route, ok, parseBody, enforceRateLimit } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { riskExplanation } from "@/lib/ai/service";
import { serializeBigInt } from "@/lib/money";

const bodySchema = z.object({
  transactionId: z.string().uuid(),
});

export const POST = route(async (req) => {
  const user = await requireUser();
  enforceRateLimit(req, "ai", { max: 20, windowMs: 60000 }, user.id);
  const body = await parseBody(req, bodySchema);

  const result = await riskExplanation(user.id, body.transactionId);

  return ok(serializeBigInt(result));
});
