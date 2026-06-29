import { Currency } from "@prisma/client";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";

/**
 * Renders a monetary amount (minor units as bigint|string) with tabular figures
 * and optional sign-based coloring. Amounts come from the API as strings.
 */
export function MoneyText({
  amount,
  currency,
  className,
  signed = false,
  colored = false,
  withSymbol = false,
}: {
  amount: bigint | string | number;
  currency: Currency;
  className?: string;
  signed?: boolean;
  colored?: boolean;
  withSymbol?: boolean;
}) {
  const value = typeof amount === "bigint" ? amount : BigInt(String(amount).split(".")[0] || "0");
  const negative = value < 0n;
  return (
    <span
      className={cn(
        "tabular-nums",
        colored && (negative ? "text-destructive" : "text-success"),
        className,
      )}
    >
      {formatMoney(amount, currency, {
        withSymbol,
        withCode: !withSymbol,
        signDisplay: signed ? "always" : "auto",
      })}
    </span>
  );
}
