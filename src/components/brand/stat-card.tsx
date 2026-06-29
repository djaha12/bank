"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Premium metric tile: glass surface, glowing gradient icon chip, optional
 * delta + sparkline slot, hover lift, entrance animation.
 */
export function StatCard({
  label,
  value,
  hint,
  delta,
  icon,
  className,
  premium = false,
  accent = "violet",
  index = 0,
  children,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  delta?: { value: string; positive: boolean };
  icon?: React.ReactNode;
  className?: string;
  premium?: boolean;
  accent?: "violet" | "cyan" | "emerald" | "blue";
  index?: number;
  children?: React.ReactNode;
}) {
  const accentBg = {
    violet: "from-brand-violet/30 to-brand-violet/5 text-brand-violet",
    cyan: "from-brand-cyan/30 to-brand-cyan/5 text-brand-cyan",
    emerald: "from-brand-emerald/30 to-brand-emerald/5 text-brand-emerald",
    blue: "from-brand-blue/30 to-brand-blue/5 text-brand-blue",
  }[accent];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "lift group relative overflow-hidden rounded-2xl p-5",
        premium ? "premium-surface text-white" : "glass-card",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className={cn("text-xs font-medium uppercase tracking-wider", premium ? "text-white/70" : "text-muted-foreground")}>
          {label}
        </span>
        {icon && (
          <span className={cn("grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br ring-1 ring-white/10", accentBg)}>
            {icon}
          </span>
        )}
      </div>
      <div className="mt-3 font-display text-2xl font-semibold tracking-tight tabular-nums">{value}</div>
      <div className="mt-1 flex items-center gap-2">
        {delta && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium",
              delta.positive ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive",
            )}
          >
            {delta.positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {delta.value}
          </span>
        )}
        {hint && <span className={cn("text-xs", premium ? "text-white/60" : "text-muted-foreground")}>{hint}</span>}
      </div>
      {children}
    </motion.div>
  );
}
