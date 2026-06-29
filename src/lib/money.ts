import { Currency } from "@prisma/client";

/**
 * Money is always represented as BigInt MINOR UNITS (tyiyn / cents).
 * Never use floats for money. The `Money` value object pairs an integer amount
 * with its currency so we can't accidentally add KGS to USD.
 */
export interface Money {
  amount: bigint; // minor units
  currency: Currency;
}

interface CurrencyMeta {
  code: Currency;
  symbol: string;
  decimals: number; // number of minor-unit digits
  label: string;
  minorLabel: string;
}

export const CURRENCY_META: Record<Currency, CurrencyMeta> = {
  KGS: { code: "KGS", symbol: "с", decimals: 2, label: "Kyrgyzstani som", minorLabel: "tyiyn" },
  USD: { code: "USD", symbol: "$", decimals: 2, label: "US dollar", minorLabel: "cent" },
  EUR: { code: "EUR", symbol: "€", decimals: 2, label: "Euro", minorLabel: "cent" },
};

export const SUPPORTED_CURRENCIES = Object.keys(CURRENCY_META) as Currency[];

export function minorFactor(currency: Currency): bigint {
  return 10n ** BigInt(CURRENCY_META[currency].decimals);
}

export function money(amount: bigint, currency: Currency): Money {
  return { amount, currency };
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new Error(`Currency mismatch: ${a.currency} vs ${b.currency}`);
  }
}

export function addMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return { amount: a.amount + b.amount, currency: a.currency };
}

export function subMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return { amount: a.amount - b.amount, currency: a.currency };
}

export function isNegative(m: Money): boolean {
  return m.amount < 0n;
}

/** Apply a basis-points rate to an integer amount, rounding down (floor). */
export function applyBps(amount: bigint, bps: number): bigint {
  return (amount * BigInt(bps)) / 10000n;
}

/**
 * Parse a human decimal string/number ("1234.56") into minor units for a
 * currency. Rejects malformed input and excess precision.
 */
export function toMinorUnits(value: string | number, currency: Currency): bigint {
  const decimals = CURRENCY_META[currency].decimals;
  const raw = typeof value === "number" ? value.toString() : value.trim();
  if (!/^-?\d+(\.\d+)?$/.test(raw)) {
    throw new Error(`Invalid monetary value: "${raw}"`);
  }
  const negative = raw.startsWith("-");
  const unsigned = negative ? raw.slice(1) : raw;
  const [whole, fraction = ""] = unsigned.split(".");
  if (fraction.length > decimals) {
    throw new Error(
      `Too many decimal places for ${currency} (max ${decimals}): "${raw}"`,
    );
  }
  const paddedFraction = fraction.padEnd(decimals, "0");
  const combined = `${whole}${paddedFraction}`.replace(/^0+(?=\d)/, "");
  const result = BigInt(combined === "" ? "0" : combined);
  return negative ? -result : result;
}

/** Convert minor units to a plain decimal string ("1234.56"). */
export function fromMinorUnits(amount: bigint, currency: Currency): string {
  const decimals = CURRENCY_META[currency].decimals;
  const factor = minorFactor(currency);
  const negative = amount < 0n;
  const abs = negative ? -amount : amount;
  const whole = abs / factor;
  const fraction = abs % factor;
  const fractionStr = fraction.toString().padStart(decimals, "0");
  const sign = negative ? "-" : "";
  return decimals === 0 ? `${sign}${whole}` : `${sign}${whole}.${fractionStr}`;
}

interface FormatOptions {
  withSymbol?: boolean;
  withCode?: boolean;
  signDisplay?: "auto" | "always" | "never";
}

/** Format minor units as a localized, grouped string, e.g. "1,234.56 $". */
export function formatMoney(
  amount: bigint | number | string,
  currency: Currency,
  options: FormatOptions = {},
): string {
  const { withSymbol = false, withCode = true, signDisplay = "auto" } = options;
  const value =
    typeof amount === "bigint"
      ? amount
      : BigInt(typeof amount === "number" ? Math.trunc(amount) : amount);
  const meta = CURRENCY_META[currency];
  const negative = value < 0n;
  const decimalStr = fromMinorUnits(negative ? -value : value, currency);
  const [whole = "0", fraction] = decimalStr.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const number = fraction ? `${grouped}.${fraction}` : grouped;

  let sign = "";
  if (negative && signDisplay !== "never") sign = "-";
  else if (!negative && signDisplay === "always") sign = "+";

  const parts: string[] = [];
  if (withSymbol) parts.push(meta.symbol);
  parts.push(`${sign}${number}`);
  if (withCode) parts.push(meta.code);
  return parts.join(" ").trim();
}

/**
 * Recursively convert BigInt values to strings so an object graph can be
 * JSON-serialized (BigInt is not valid JSON and breaks the RSC boundary).
 */
export function serializeBigInt<T>(input: T): T {
  if (typeof input === "bigint") return input.toString() as unknown as T;
  if (Array.isArray(input)) return input.map(serializeBigInt) as unknown as T;
  if (input instanceof Date) return input as T;
  if (input && typeof input === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input)) out[k] = serializeBigInt(v);
    return out as T;
  }
  return input;
}
