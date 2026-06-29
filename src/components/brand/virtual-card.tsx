"use client";

import { motion } from "framer-motion";
import { Snowflake, Wifi } from "lucide-react";
import { Currency } from "@prisma/client";
import { cn } from "@/lib/utils";

/**
 * Premium virtual card visual. Shows ONLY the masked last-4 — never a real PAN
 * (none exists in the sandbox). The gradient + glass treatment is the brand's
 * hero element.
 */
export function VirtualCard({
  last4,
  holder,
  expMonth,
  expYear,
  currency,
  brand = "NEO",
  frozen = false,
  className,
}: {
  last4: string;
  holder: string;
  expMonth: number;
  expYear: number;
  currency: Currency;
  brand?: string;
  frozen?: boolean;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, rotateX: -8 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      whileHover={{ y: -4, scale: 1.01 }}
      transition={{ type: "spring", stiffness: 200, damping: 18 }}
      className={cn(
        "relative aspect-[1.586/1] w-full max-w-sm overflow-hidden rounded-2xl p-6 text-white shadow-glow",
        "bg-[radial-gradient(120%_120%_at_0%_0%,#6d28d9_0%,#2563eb_45%,#059669_100%)]",
        frozen && "grayscale-[60%] opacity-80",
        className,
      )}
    >
      {/* sheen */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(105deg,rgba(255,255,255,0.18)_0%,transparent_35%,transparent_60%,rgba(255,255,255,0.08)_100%)]" />
      <div className="relative flex h-full flex-col justify-between">
        <div className="flex items-start justify-between">
          <span className="text-lg font-semibold tracking-tight">{brand} BANK</span>
          {frozen ? <Snowflake className="h-5 w-5" /> : <Wifi className="h-5 w-5 rotate-90 opacity-90" />}
        </div>

        <div className="flex items-center gap-3">
          <div className="h-9 w-12 rounded-md bg-[linear-gradient(135deg,#f5d27a,#d9a441)] shadow-inner" />
          <span className="font-mono text-lg tracking-[0.25em] opacity-95">•••• {last4}</span>
        </div>

        <div className="flex items-end justify-between">
          <div className="space-y-0.5">
            <div className="text-[10px] uppercase tracking-widest opacity-70">Card holder</div>
            <div className="text-sm font-medium uppercase">{holder}</div>
          </div>
          <div className="space-y-0.5 text-right">
            <div className="text-[10px] uppercase tracking-widest opacity-70">Expires</div>
            <div className="font-mono text-sm">
              {String(expMonth).padStart(2, "0")}/{String(expYear).slice(-2)}
            </div>
          </div>
          <div className="text-sm font-semibold tracking-wide">{currency}</div>
        </div>
      </div>
    </motion.div>
  );
}
