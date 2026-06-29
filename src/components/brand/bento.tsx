"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/** Responsive bento grid. Children are <BentoCard/> with col/row spans. */
export function BentoGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4", className)}>
      {children}
    </div>
  );
}

/**
 * A premium bento tile: glass surface + glowing gradient ring + hover lift +
 * staggered entrance. Use `span`/`rowSpan` for layout and `glow` for accent.
 */
export function BentoCard({
  children,
  className,
  span = 1,
  rowSpan = 1,
  index = 0,
  glow = false,
  premium = false,
  as = "div",
}: {
  children: React.ReactNode;
  className?: string;
  span?: 1 | 2 | 3 | 4;
  rowSpan?: 1 | 2 | 3;
  index?: number;
  glow?: boolean;
  premium?: boolean;
  as?: "div" | "section";
}) {
  const spanCls = {
    1: "sm:col-span-1",
    2: "sm:col-span-2",
    3: "sm:col-span-2 lg:col-span-3",
    4: "sm:col-span-2 lg:col-span-4",
  }[span];
  const rowCls = { 1: "", 2: "lg:row-span-2", 3: "lg:row-span-3" }[rowSpan];

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "lift group relative overflow-hidden rounded-3xl p-5",
        premium ? "premium-surface text-white" : "glass-card",
        glow && "ring-glow",
        spanCls,
        rowCls,
        className,
      )}
    >
      {children}
    </motion.div>
  );
}
