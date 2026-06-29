import * as React from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  delta,
  icon,
  className,
  premium = false,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  delta?: { value: string; positive: boolean };
  icon?: React.ReactNode;
  className?: string;
  premium?: boolean;
}) {
  return (
    <Card className={cn("p-5", premium && "premium-surface text-white border-white/10", className)}>
      <div className="flex items-center justify-between">
        <span className={cn("text-sm", premium ? "text-white/70" : "text-muted-foreground")}>{label}</span>
        {icon && (
          <span className={cn("rounded-lg p-1.5", premium ? "bg-white/10" : "bg-muted")}>{icon}</span>
        )}
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-tight tabular-nums">{value}</div>
      <div className="mt-1 flex items-center gap-2">
        {delta && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-xs font-medium",
              delta.positive ? "text-success" : "text-destructive",
            )}
          >
            {delta.positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {delta.value}
          </span>
        )}
        {hint && <span className={cn("text-xs", premium ? "text-white/60" : "text-muted-foreground")}>{hint}</span>}
      </div>
    </Card>
  );
}
