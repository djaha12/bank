"use client";

import * as React from "react";
import {
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ListTree,
  RotateCcw,
  ShieldAlert,
  ArrowDownLeft,
  ArrowUpRight,
} from "lucide-react";
import { apiFetch } from "@/lib/client";
import { Currency } from "@prisma/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MoneyText } from "@/components/brand/money-text";
import { EmptyState, ErrorState } from "@/components/brand/states";
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

interface LedgerEntry {
  id: string;
  direction: "DEBIT" | "CREDIT";
  amount: string;
  currency: Currency;
  balanceAfter: string;
  accountId: string;
  accountName: string | null;
  ownerType: string | null;
  createdAt: string;
}

export interface TransactionRow {
  id: string;
  type: string;
  status: string;
  currency: Currency;
  amount: string;
  feeAmount: string;
  description: string | null;
  reference: string | null;
  userId: string | null;
  userEmail: string | null;
  createdAt: string;
  // Embedded for the initial server payload; absent on client-filtered rows.
  ledgerEntries?: LedgerEntry[];
}

interface ApiResponse {
  transactions: Omit<TransactionRow, "ledgerEntries">[];
  total: number;
  take: number;
  skip: number;
}

const STATUS_OPTIONS = ["ALL", "PENDING", "COMPLETED", "FAILED", "REVERSED"] as const;
const TYPE_OPTIONS = [
  "ALL",
  "DEMO_DEPOSIT",
  "INTERNAL_TRANSFER",
  "P2P_TRANSFER",
  "FX_CONVERSION",
  "CARD_AUTHORIZATION",
  "CARD_CAPTURE",
  "FEE",
  "REVERSAL",
  "REFUND",
  "ADJUSTMENT",
] as const;

function statusVariant(status: string): BadgeVariant {
  switch (status) {
    case "COMPLETED":
      return "success";
    case "PENDING":
      return "warning";
    case "FAILED":
      return "destructive";
    case "REVERSED":
      return "secondary";
    default:
      return "secondary";
  }
}

function human(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());
}

function fmtDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function TransactionsClient({
  initialRows,
  total,
  pageSize,
}: {
  initialRows: TransactionRow[];
  total: number;
  pageSize: number;
}) {
  const [rows, setRows] = React.useState<TransactionRow[]>(initialRows);
  const [count, setCount] = React.useState(total);
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState<string>("ALL");
  const [type, setType] = React.useState<string>("ALL");
  const [skip, setSkip] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [dirty, setDirty] = React.useState(false);

  const [ledgerFor, setLedgerFor] = React.useState<TransactionRow | null>(null);
  const [reverseFor, setReverseFor] = React.useState<TransactionRow | null>(null);

  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchRows = React.useCallback(
    async (opts: { q: string; status: string; type: string; skip: number }) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (opts.q) params.set("q", opts.q);
        if (opts.status !== "ALL") params.set("status", opts.status);
        if (opts.type !== "ALL") params.set("type", opts.type);
        params.set("take", String(pageSize));
        params.set("skip", String(opts.skip));
        const data = await apiFetch<ApiResponse>(`/api/admin/transactions?${params.toString()}`);
        setRows(data.transactions);
        setCount(data.total);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load transactions");
      } finally {
        setLoading(false);
      }
    },
    [pageSize],
  );

  function applyFilters(next: Partial<{ q: string; status: string; type: string }>) {
    const q = next.q ?? query;
    const s = next.status ?? status;
    const t = next.type ?? type;
    setDirty(true);
    setSkip(0);
    void fetchRows({ q: q.trim(), status: s, type: t, skip: 0 });
  }

  function onQueryChange(value: string) {
    setQuery(value);
    setDirty(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => applyFilters({ q: value }), 300);
  }

  function goto(nextSkip: number) {
    setSkip(nextSkip);
    void fetchRows({ q: query.trim(), status, type, skip: nextSkip });
  }

  const ledgerEntries = ledgerFor?.ledgerEntries;
  const ledgerAvailable = ledgerEntries !== undefined;

  const pageCount = Math.max(1, Math.ceil(count / pageSize));
  const page = Math.floor(skip / pageSize) + 1;
  const from = count === 0 ? 0 : skip + 1;
  const to = Math.min(skip + pageSize, count);

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-border/60 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Reference, description or email…"
              className="pl-9"
              aria-label="Search transactions"
            />
            {loading && (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v);
              applyFilters({ status: v });
            }}
          >
            <SelectTrigger className="w-full sm:w-40" aria-label="Filter by status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s === "ALL" ? "All statuses" : human(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={type}
            onValueChange={(v) => {
              setType(v);
              applyFilters({ type: v });
            }}
          >
            <SelectTrigger className="w-full sm:w-48" aria-label="Filter by type">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              {TYPE_OPTIONS.map((t) => (
                <SelectItem key={t} value={t}>
                  {t === "ALL" ? "All types" : human(t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <span className="shrink-0 text-sm text-muted-foreground">
          {dirty
            ? `${count.toLocaleString()} match${count === 1 ? "" : "es"}`
            : `Showing ${from}–${to} of ${count.toLocaleString()}`}
        </span>
      </div>

      {error ? (
        <div className="p-6">
          <ErrorState description={error} />
        </div>
      ) : loading && rows.length === 0 ? (
        <div className="space-y-3 p-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="p-6">
          <EmptyState
            title="No transactions found"
            description="Adjust the filters or search to find what you're looking for."
          />
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reference</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden lg:table-cell">Date</TableHead>
              <TableHead className="text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <span className="font-mono text-xs">{r.reference ?? r.id.slice(0, 8)}</span>
                  {r.description && (
                    <span className="block max-w-[200px] truncate text-xs text-muted-foreground">
                      {r.description}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  {r.userEmail ?? <span className="text-muted-foreground">System</span>}
                </TableCell>
                <TableCell>
                  <span className="text-xs text-muted-foreground">{human(r.type)}</span>
                </TableCell>
                <TableCell className="text-right">
                  <MoneyText amount={r.amount} currency={r.currency} className="font-medium" />
                  {r.feeAmount !== "0" && (
                    <span className="block text-[11px] text-muted-foreground">
                      fee <MoneyText amount={r.feeAmount} currency={r.currency} />
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
                </TableCell>
                <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">
                  {fmtDateTime(r.createdAt)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setLedgerFor(r)}>
                      <ListTree className="h-4 w-4" /> Ledger
                    </Button>
                    {r.status === "COMPLETED" && (
                      <Button variant="ghost" size="sm" onClick={() => setReverseFor(r)}>
                        <RotateCcw className="h-4 w-4" /> Reverse
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {!dirty && pageCount > 1 && (
        <div className="flex items-center justify-between border-t border-border/60 p-4">
          <span className="text-sm text-muted-foreground">
            Page {page} of {pageCount}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={skip <= 0} onClick={() => goto(Math.max(0, skip - pageSize))}>
              <ChevronLeft className="h-4 w-4" /> Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={skip + pageSize >= count}
              onClick={() => goto(skip + pageSize)}
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Ledger entries dialog */}
      <Dialog open={ledgerFor !== null} onOpenChange={(o) => !o && setLedgerFor(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Ledger entries</DialogTitle>
            <DialogDescription>
              Double-entry postings for{" "}
              <span className="font-mono text-xs">
                {ledgerFor?.reference ?? ledgerFor?.id.slice(0, 8)}
              </span>
              . Debits and credits sum to zero within each currency.
            </DialogDescription>
          </DialogHeader>

          {!ledgerAvailable ? (
            <EmptyState
              title="Open from the default view"
              description="Ledger postings are loaded with the unfiltered list. Clear the filters and reopen this transaction to inspect its entries."
            />
          ) : ledgerEntries && ledgerEntries.length > 0 ? (
            <div className="space-y-2">
              {ledgerEntries.map((e) => {
                const isDebit = e.direction === "DEBIT";
                return (
                  <div
                    key={e.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/20 p-3"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className={
                          isDebit
                            ? "rounded-md bg-destructive/10 p-1.5 text-destructive"
                            : "rounded-md bg-success/10 p-1.5 text-success"
                        }
                      >
                        {isDebit ? (
                          <ArrowUpRight className="h-4 w-4" />
                        ) : (
                          <ArrowDownLeft className="h-4 w-4" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">
                          {e.accountName ?? e.accountId.slice(0, 8)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {e.ownerType ?? "—"} · bal{" "}
                          <MoneyText amount={e.balanceAfter} currency={e.currency} />
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant={isDebit ? "destructive" : "success"} className="mb-1">
                        {e.direction}
                      </Badge>
                      <MoneyText
                        amount={e.amount}
                        currency={e.currency}
                        className="block text-sm font-semibold"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState title="No ledger entries" description="This transaction has no postings." />
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setLedgerFor(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reverse confirmation dialog (routes through disputes/reversal — compliance only) */}
      <Dialog open={reverseFor !== null} onOpenChange={(o) => !o && setReverseFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Flag for reversal</DialogTitle>
            <DialogDescription>
              Reversals are not initiated directly from the transactions view.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-start gap-2.5 rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <div className="space-y-1.5 text-muted-foreground">
              <p>
                Reversing{" "}
                <span className="font-mono text-xs text-foreground">
                  {reverseFor?.reference ?? reverseFor?.id.slice(0, 8)}
                </span>{" "}
                (
                {reverseFor && (
                  <MoneyText
                    amount={reverseFor.amount}
                    currency={reverseFor.currency}
                    className="text-foreground"
                  />
                )}
                ) posts compensating ledger entries.
              </p>
              <p>
                To preserve the audit trail, reversals run through the{" "}
                <span className="font-medium text-foreground">disputes / reversal workflow</span>.
                Open a dispute on this transaction and resolve it with a refund — a compliance
                officer with the reversal permission completes the action.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReverseFor(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
