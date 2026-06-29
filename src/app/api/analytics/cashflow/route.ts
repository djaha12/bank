import { route, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { cashflow } from "@/lib/analytics";
import { serializeBigInt } from "@/lib/money";
import { Currency } from "@prisma/client";

const SUPPORTED = new Set<Currency>([Currency.KGS, Currency.USD, Currency.EUR]);

function parseCurrency(raw: string | null): Currency {
  if (raw && SUPPORTED.has(raw as Currency)) return raw as Currency;
  return Currency.KGS;
}

function parseMonths(raw: string | null): number {
  if (!raw) return 6;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return 6;
  return Math.min(n, 24);
}

export const GET = route(async (req) => {
  const user = await requireUser();
  const url = new URL(req.url);
  const currency = parseCurrency(url.searchParams.get("currency"));
  const months = parseMonths(url.searchParams.get("months"));

  const points = await cashflow(user.id, currency, months);

  return ok(serializeBigInt({ currency, months, cashflow: points }));
});
