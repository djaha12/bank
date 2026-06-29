"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { ArrowDownLeft, ArrowUpRight, Download, Filter, Inbox } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
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
    <div className="glass-card space-y-4 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <Filter className="h-3.5 w-3.5" /> Filter
          </span>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-9 w-[170px] rounded-xl">
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
            <SelectTrigger className="h-9 w-[150px] rounded-xl">
              <SelectValue placeholder="All directions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All directions</SelectItem>
              <SelectItem value="CREDIT">Money in</SelectItem>
              <SelectItem value="DEBIT">Money out</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" className="rounded-xl" onClick={handleExport} disabled={exporting}>
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
        <>
          {/* Desktop / tablet table */}
          <div className="hidden overflow-hidden rounded-2xl border border-border/60 sm:block">
            <Table>
              <TableHeader>
                <TableRow className="border-border/60 hover:bg-transparent">
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r, i) => {
                  const inflow = r.direction === "CREDIT";
                  return (
                    <motion.tr
                      key={r.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: Math.min(i, 12) * 0.025, ease: [0.22, 1, 0.36, 1] }}
                      className="border-b border-border/50 transition-colors last:border-0 hover:bg-muted/40"
                    >
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {formatDate(r.date)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ring-1 ring-white/10 ${
                              inflow ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {inflow ? (
                              <ArrowDownLeft className="h-4 w-4" />
                            ) : (
                              <ArrowUpRight className="h-4 w-4" />
                            )}
                          </span>
                          <div className="min-w-0">
                            <div className="font-medium leading-tight">{r.typeLabel}</div>
                            {r.description && (
                              <div className="truncate text-xs text-muted-foreground">{r.description}</div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={inflow ? "success" : "secondary"} className="gap-1">
                          {inflow ? (
                            <ArrowDownLeft className="h-3 w-3" />
                          ) : (
                            <ArrowUpRight className="h-3 w-3" />
                          )}
                          {inflow ? "In" : "Out"}
                        </Badge>
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
                    </motion.tr>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile card rows */}
          <ul className="space-y-2.5 sm:hidden">
            {filtered.map((r, i) => {
              const inflow = r.direction === "CREDIT";
              return (
                <motion.li
                  key={r.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: Math.min(i, 12) * 0.025, ease: [0.22, 1, 0.36, 1] }}
                  className="rounded-2xl border border-border/60 bg-card/60 p-3.5 transition-colors hover:bg-muted/40"
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ring-1 ring-white/10 ${
                        inflow ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {inflow ? (
                        <ArrowDownLeft className="h-4 w-4" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="truncate font-medium leading-tight">{r.typeLabel}</div>
                        <MoneyText
                          amount={r.signedAmount}
                          currency={currency}
                          signed
                          colored
                          className="shrink-0 font-semibold"
                        />
                      </div>
                      {r.description && (
                        <div className="truncate text-xs text-muted-foreground">{r.description}</div>
                      )}
                      <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                        <span className="whitespace-nowrap">{formatDate(r.date)}</span>
                        <span className="tabular-nums">
                          Bal <MoneyText amount={r.balanceAfter} currency={currency} />
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
