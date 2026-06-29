import { route, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { budgetProgress } from "@/lib/analytics";
import { serializeBigInt } from "@/lib/money";

export const GET = route(async () => {
  const user = await requireUser();
  const budgets = await budgetProgress(user.id);
  return ok(serializeBigInt({ budgets }));
});
