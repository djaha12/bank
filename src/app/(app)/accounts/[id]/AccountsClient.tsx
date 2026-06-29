"use client";

import * as React from "react";
import { Download, Filter, Inbox } from "lucide-react";
import { Currency } from "@prisma/client";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { MoneyText } from "@/components/brand/money-text";
import { EmptyState } from "@/components/brand/states";

export interface AccountTxnRow {
  id: string;
  date: string; // ISO
  type: string; // raw TransactionType
  typeLabel: string;
  direction: "DEBIT" | "CREDIT";
  /** Signed minor units as string (CREDIT positive, DEBIT negative). */
  signedAmount: string;
  /** balanceAfter minor units as string. */
  balanceAfter: string;
  description: string | null;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AccountsClient({
  accountId,
  currency,
  rows,
  types,
}: {
  accountId: string;
  currency: Currency;
  rows: AccountTxnRow[];
  types: { value: string; label: string }[];
}) {
  const [typeFilter, setTypeFilter] = React.useState<string>("all");
  const [dirFilter, setDirFilter] = React.useState<string>("all");
  const [exporting, setExporting] = React.useState(false);

  const filtered = React.useMemo(() => {
    return rows.filter((r) => {
      if (typeFilter !== "all" && r.type !== typeFilter) return false;
      if (dirFilter !== "all" && r.direction !== dirFilter) return false;
      return true;
    });
  }, [rows, typeFilter, dirFilter]);

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch(`/api/accounts/${accountId}/transactions?format=csv`);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error?.message ?? `Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `account-${accountId}-transactions.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Export ready", { description: "Your CSV download has started." });
    } catch (err) {
      toast.error("Could not export", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-9 w-[170px]">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {types.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={dirFilter} onValueChange={setDirFilter}>
            <SelectTrigger className="h-9 w-[150px]">
              <SelectValue placeholder="All directions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All directions</SelectItem>
              <SelectItem value="CREDIT">Money in</SelectItem>
              <SelectItem value="DEBIT">Money out</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
          <Download className="h-4 w-4" />
          {exporting ? "Exporting…" : "Export CSV"}
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No transactions"
          description={
            rows.length === 0
              ? "This account has no activity yet."
              : "No transactions match the selected filters."
          }
          icon={<Inbox className="h-6 w-6" />}
        />
      ) : (
        <div className="rounded-xl border border-border/70">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Direction</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatDate(r.date)}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{r.typeLabel}</div>
                    {r.description && (
                      <div className="text-xs text-muted-foreground">{r.description}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <span
                      className={
                        r.direction === "CREDIT"
                          ? "text-xs font-medium text-success"
                          : "text-xs font-medium text-muted-foreground"
                      }
                    >
                      {r.direction === "CREDIT" ? "In" : "Out"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <MoneyText
                      amount={r.signedAmount}
                      currency={currency}
                      signed
                      colored
                      className="font-semibold"
                    />
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    <MoneyText amount={r.balanceAfter} currency={currency} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
