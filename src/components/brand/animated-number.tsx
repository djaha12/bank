"use client";

import * as React from "react";
import { Currency } from "@prisma/client";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";

function useCountUp(target: number, durationMs = 900) {
  const [value, setValue] = React.useState(0);
  const startRef = React.useRef<number | null>(null);
  React.useEffect(() => {
    let raf = 0;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setValue(target);
      return;
    }
    const tick = (t: number) => {
      if (startRef.current === null) startRef.current = t;
      const p = Math.min(1, (t - startRef.current) / durationMs);
      // easeOutExpo
      const eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      setValue(target * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return value;
}

/** Count-up money. `amount` is minor units (bigint | string | number). */
export function AnimatedMoney({
  amount,
  currency,
  className,
  durationMs = 1000,
  withSymbol = false,
}: {
  amount: bigint | string | number;
  currency: Currency;
  className?: string;
  durationMs?: number;
  withSymbol?: boolean;
}) {
  const targetMinor =
    typeof amount === "bigint" ? Number(amount) : Number(String(amount).split(".")[0] || 0);
  const v = useCountUp(targetMinor, durationMs);
  return (
    <span className={cn("tabular-nums", className)}>
      {formatMoney(BigInt(Math.round(v)), currency, { withSymbol, withCode: !withSymbol })}
    </span>
  );
}

/** Count-up plain number with optional suffix/prefix. */
export function AnimatedNumber({
  value,
  className,
  durationMs = 900,
  decimals = 0,
  prefix = "",
  suffix = "",
}: {
  value: number;
  className?: string;
  durationMs?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
}) {
  const v = useCountUp(value, durationMs);
  return (
    <span className={cn("tabular-nums", className)}>
      {prefix}
      {v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </span>
  );
}
