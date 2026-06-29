import { route, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { spendingByCategory } from "@/lib/analytics";
import { serializeBigInt } from "@/lib/money";
import { Currency } from "@prisma/client";
import { subDays } from "date-fns";

const SUPPORTED = new Set<Currency>([Currency.KGS, Currency.USD, Currency.EUR]);

function parseCurrency(raw: string | null): Currency {
  if (raw && SUPPORTED.has(raw as Currency)) return raw as Currency;
  return Currency.KGS;
}

function parseDays(raw: string | null): number {
  if (!raw) return 30;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return 30;
  return Math.min(n, 365);
}

export const GET = route(async (req) => {
  const user = await requireUser();
  const url = new URL(req.url);
  const currency = parseCurrency(url.searchParams.get("currency"));
  const days = parseDays(url.searchParams.get("days"));
  const since = subDays(new Date(), days);

  const categories = await spendingByCategory(user.id, currency, since);
  const total = categories.reduce((sum, c) => sum + c.amount, 0n);

  return ok(
    serializeBigInt({
      currency,
      days,
      total,
      spendingByCategory: categories,
    }),
  );
});
