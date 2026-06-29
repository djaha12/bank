import { z } from "zod";
import { route, ok, parseBody, enforceRateLimit } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { spendingInsight } from "@/lib/ai/service";
import { serializeBigInt } from "@/lib/money";
import { Currency } from "@prisma/client";

const bodySchema = z.object({
  currency: z.enum(["KGS", "USD", "EUR"]).optional(),
});

export const POST = route(async (req) => {
  const user = await requireUser();
  enforceRateLimit(req, "ai", { max: 20, windowMs: 60000 }, user.id);
  const body = await parseBody(req, bodySchema);

  const currency: Currency = body.currency ?? "KGS";
  const result = await spendingInsight(user.id, currency);

  return ok(serializeBigInt(result));
});
