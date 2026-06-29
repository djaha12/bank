"use client";

import * as React from "react";
import { Search, Snowflake, Sun, CreditCard, FlaskConical, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Currency } from "@prisma/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/brand/states";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type BadgeVariant = "default" | "secondary" | "success" | "warning" | "destructive" | "outline";

export interface CardRow {
  id: string;
  last4: string;
  brand: string;
  status: string;
  cardholderName: string;
  expMonth: number;
  expYear: number;
  userId: string | null;
  userEmail: string | null;
  currency: Currency;
  accountName: string | null;
}

const STATUS_OPTIONS = ["ALL", "ACTIVE", "FROZEN", "CLOSED"] as const;

function statusVariant(status: string): BadgeVariant {
  switch (status) {
    case "ACTIVE":
      return "success";
    case "FROZEN":
      return "default";
    case "CLOSED":
      return "destructive";
    default:
      return "secondary";
  }
}

export function CardsClient({ rows }: { rows: CardRow[] }) {
  const [cards, setCards] = React.useState<CardRow[]>(rows);
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState<string>("ALL");
  const [target, setTarget] = React.useState<{ card: CardRow; next: "FROZEN" | "ACTIVE" } | null>(
    null,
  );
  const [busy, setBusy] = React.useState(false);

  const filtered = cards.filter((c) => {
    if (status !== "ALL" && c.status !== status) return false;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      return (
        c.last4.includes(q) ||
        c.cardholderName.toLowerCase().includes(q) ||
        (c.userEmail?.toLowerCase().includes(q) ?? false)
      );
    }
    return true;
  });

  function confirmToggle() {
    if (!target) return;
    setBusy(true);
    // Sandbox operation: there is no admin freeze endpoint (the customer-facing
    // route is owner-scoped), so the state transition is applied locally to the
    // sandbox view and surfaced as such.
    setTimeout(() => {
      setCards((prev) =>
        prev.map((c) => (c.id === target.card.id ? { ...c, status: target.next } : c)),
      );
      toast.success(
        target.next === "FROZEN"
          ? `Card ••${target.card.last4} frozen (sandbox)`
          : `Card ••${target.card.last4} unfrozen (sandbox)`,
      );
      setBusy(false);
      setTarget(null);
    }, 350);
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-border/60 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="last4, cardholder or email…"
              className="pl-9"
              aria-label="Search cards"
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-full sm:w-40" aria-label="Filter by status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s === "ALL" ? "All statuses" : s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-warning/30 bg-warning/5 px-2.5 py-1 text-xs text-warning">
          <FlaskConical className="h-3.5 w-3.5" /> Sandbox ops
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="p-6">
          <EmptyState
            title="No cards found"
            description="No cards match the current filters."
            icon={<CreditCard className="h-6 w-6" />}
          />
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Card</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead className="hidden md:table-cell">Account</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-12 items-center justify-center rounded-md bg-brand-gradient text-[10px] font-semibold text-white">
                      {c.brand}
                    </span>
                    <div>
                      <div className="font-mono text-sm">•••• {c.last4}</div>
                      <div className="text-xs text-muted-foreground">
                        {c.cardholderName} · {String(c.expMonth).padStart(2, "0")}/
                        {String(c.expYear).slice(-2)}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-sm">{c.userEmail ?? "—"}</TableCell>
                <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                  {c.currency}
                  {c.accountName ? ` · ${c.accountName}` : ""}
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant(c.status)}>{c.status}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  {c.status === "ACTIVE" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setTarget({ card: c, next: "FROZEN" })}
                    >
                      <Snowflake className="h-4 w-4" /> Freeze
                    </Button>
                  )}
                  {c.status === "FROZEN" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setTarget({ card: c, next: "ACTIVE" })}
                    >
                      <Sun className="h-4 w-4" /> Unfreeze
                    </Button>
                  )}
                  {c.status === "CLOSED" && (
                    <span className="text-xs text-muted-foreground">No actions</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={target !== null} onOpenChange={(o) => !busy && !o && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {target?.next === "FROZEN" ? "Freeze card" : "Unfreeze card"}
            </DialogTitle>
            <DialogDescription>
              {target?.next === "FROZEN"
                ? "Freezing blocks new authorizations on this card."
                : "Unfreezing restores normal card activity."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-start gap-2.5 rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm text-muted-foreground">
            <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <span>
              This is a <span className="font-medium text-foreground">sandbox operation</span>.
              Customer-initiated freeze/unfreeze runs through the owner-scoped card API; here the
              transition is applied to the operations view for{" "}
              <span className="font-mono text-foreground">•••• {target?.card.last4}</span>.
            </span>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTarget(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="gradient" onClick={confirmToggle} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {target?.next === "FROZEN" ? "Freeze card" : "Unfreeze card"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
