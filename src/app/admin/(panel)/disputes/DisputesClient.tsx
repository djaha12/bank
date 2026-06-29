"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Search,
  Gavel,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/client";
import { Currency } from "@prisma/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { MoneyText } from "@/components/brand/money-text";
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

export interface DisputeRow {
  id: string;
  userId: string;
  userEmail: string | null;
  transactionId: string;
  transactionRef: string | null;
  transactionType: string | null;
  reason: string;
  status: string;
  amount: string;
  currency: Currency;
  resolution: string | null;
  handledBy: string | null;
  createdAt: string;
}

const STATUS_OPTIONS = ["ALL", "OPEN", "INVESTIGATING", "RESOLVED", "REJECTED"] as const;

function statusVariant(status: string): BadgeVariant {
  switch (status) {
    case "RESOLVED":
      return "success";
    case "OPEN":
    case "INVESTIGATING":
      return "warning";
    case "REJECTED":
      return "destructive";
    default:
      return "secondary";
  }
}

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

type Decision = "RESOLVED" | "REJECTED" | "INVESTIGATING";

export function DisputesClient({ rows }: { rows: DisputeRow[] }) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState<string>("ALL");

  const [active, setActive] = React.useState<DisputeRow | null>(null);
  const [decision, setDecision] = React.useState<Decision>("RESOLVED");
  const [resolution, setResolution] = React.useState("");
  const [refund, setRefund] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const filtered = rows.filter((d) => {
    if (status !== "ALL" && d.status !== status) return false;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      return (
        (d.userEmail?.toLowerCase().includes(q) ?? false) ||
        (d.transactionRef?.toLowerCase().includes(q) ?? false) ||
        d.reason.toLowerCase().includes(q)
      );
    }
    return true;
  });

  function start(d: DisputeRow, dec: Decision) {
    setActive(d);
    setDecision(dec);
    setResolution(d.resolution ?? "");
    setRefund(false);
  }

  async function submit() {
    if (!active) return;
    if (decision === "REJECTED" && !resolution.trim()) {
      toast.error("A reason is required to reject a dispute.");
      return;
    }
    setSubmitting(true);
    try {
      const body: { status: Decision; resolution?: string; refund?: boolean } = { status: decision };
      if (resolution.trim()) body.resolution = resolution.trim();
      if (decision === "RESOLVED" && refund) body.refund = true;
      const res = await apiFetch<{ refund: { reversalId: string } | null }>(
        `/api/admin/disputes/${active.id}`,
        { method: "PATCH", body: JSON.stringify(body) },
      );
      if (decision === "RESOLVED") {
        toast.success(res.refund ? "Dispute resolved and refund issued." : "Dispute resolved.");
      } else if (decision === "REJECTED") {
        toast.success("Dispute rejected.");
      } else {
        toast.success("Dispute marked investigating.");
      }
      setActive(null);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSubmitting(false);
    }
  }

  const dialogTitle =
    decision === "RESOLVED"
      ? "Resolve dispute"
      : decision === "REJECTED"
        ? "Reject dispute"
        : "Mark investigating";

  return (
    <Card className="glass-card overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-border/60 bg-muted/20 p-4 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Email, reference or reason…"
            className="pl-9"
            aria-label="Search disputes"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full sm:w-44" aria-label="Filter by status">
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

      {filtered.length === 0 ? (
        <div className="p-6">
          <EmptyState
            title="No disputes match"
            description="Adjust the filters to see more."
            icon={<Gavel className="h-6 w-6" />}
          />
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Transaction</TableHead>
              <TableHead className="hidden lg:table-cell">Reason</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Raised</TableHead>
              <TableHead className="text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((d) => (
              <TableRow key={d.id} className="group transition-colors hover:bg-muted/40">
                <TableCell className="text-sm">{d.userEmail ?? "—"}</TableCell>
                <TableCell>
                  <span className="font-mono text-xs">{d.transactionRef ?? "—"}</span>
                  {d.transactionType && (
                    <span className="block text-xs text-muted-foreground">
                      {d.transactionType.replaceAll("_", " ")}
                    </span>
                  )}
                </TableCell>
                <TableCell className="hidden max-w-[220px] truncate text-sm text-muted-foreground lg:table-cell">
                  {d.reason}
                </TableCell>
                <TableCell className="text-right">
                  <MoneyText amount={d.amount} currency={d.currency} className="font-medium" />
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant(d.status)}>{d.status}</Badge>
                </TableCell>
                <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                  {fmtDate(d.createdAt)}
                </TableCell>
                <TableCell className="text-right">
                  {d.status === "RESOLVED" || d.status === "REJECTED" ? (
                    <span className="text-xs text-muted-foreground">Closed</span>
                  ) : (
                    <div className="flex items-center justify-end gap-1">
                      {d.status === "OPEN" && (
                        <Button variant="ghost" size="sm" onClick={() => start(d, "INVESTIGATING")}>
                          Investigate
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => start(d, "REJECTED")}>
                        <XCircle className="h-4 w-4" /> Reject
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => start(d, "RESOLVED")}>
                        <CheckCircle2 className="h-4 w-4" /> Resolve
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={active !== null} onOpenChange={(o) => !submitting && !o && setActive(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>
              {active && (
                <>
                  Dispute on{" "}
                  <span className="font-mono text-xs">{active.transactionRef ?? active.id.slice(0, 8)}</span>{" "}
                  for{" "}
                  <MoneyText amount={active.amount} currency={active.currency} /> raised by{" "}
                  {active.userEmail ?? "customer"}.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="resolution">
                {decision === "REJECTED" ? "Reason for rejection" : "Resolution notes"}
                {decision !== "REJECTED" && (
                  <span className="font-normal text-muted-foreground"> (optional)</span>
                )}
              </Label>
              <Input
                id="resolution"
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                placeholder={
                  decision === "REJECTED"
                    ? "e.g. Transaction confirmed as authorized by cardholder"
                    : "e.g. Merchant error confirmed — refunding customer"
                }
                maxLength={1000}
                autoFocus
              />
            </div>

            {decision === "RESOLVED" && (
              <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 p-3">
                <div className="flex items-center gap-2.5">
                  <RotateCcw className="h-4 w-4 text-primary" />
                  <div>
                    <Label htmlFor="refund-toggle" className="cursor-pointer">
                      Issue refund
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Posts a compensating reversal of the disputed amount.
                    </p>
                  </div>
                </div>
                <Switch id="refund-toggle" checked={refund} onCheckedChange={setRefund} />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setActive(null)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              variant={decision === "REJECTED" ? "destructive" : "gradient"}
              onClick={submit}
              disabled={submitting || (decision === "REJECTED" && !resolution.trim())}
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {dialogTitle}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
