"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Clock, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Currency } from "@prisma/client";
import { apiFetch, newIdempotencyKey } from "@/lib/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MoneyText } from "@/components/brand/money-text";

export interface HoldVM {
  id: string;
  merchantName: string | null;
  mcc: string | null;
  amount: string;
  currency: Currency;
  cardLast4: string;
  createdAt: string;
}

export function PendingHoldsClient({ holds }: { holds: HoldVM[] }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);

  if (holds.length === 0) return null;

  async function act(id: string, kind: "capture" | "release") {
    setBusy(id);
    try {
      await apiFetch(`/api/holds/${id}/${kind}`, {
        method: "POST",
        ...(kind === "capture" ? { idempotencyKey: newIdempotencyKey(), body: "{}" } : { body: "{}" }),
      });
      toast.success(kind === "capture" ? "Authorization captured" : "Authorization released");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="ring-glow">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-warning/20 text-warning">
            <Clock className="h-4 w-4" />
          </span>
          Pending authorizations
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
            {holds.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border/60">
          {holds.map((h) => (
            <li key={h.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{h.merchantName ?? "Merchant"}</div>
                <div className="text-xs text-muted-foreground">
                  •• {h.cardLast4} · MCC {h.mcc ?? "—"} · held
                </div>
              </div>
              <MoneyText amount={h.amount} currency={h.currency} className="text-sm font-semibold tabular-nums" />
              <div className="flex gap-2">
                <Button size="sm" variant="gradient" disabled={busy === h.id} onClick={() => act(h.id, "capture")}>
                  <Check className="h-3.5 w-3.5" /> Capture
                </Button>
                <Button size="sm" variant="outline" disabled={busy === h.id} onClick={() => act(h.id, "release")}>
                  <X className="h-3.5 w-3.5" /> Release
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
