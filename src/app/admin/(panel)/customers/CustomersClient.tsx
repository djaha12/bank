"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Loader2, ChevronLeft, ChevronRight, ArrowUpRight, MailCheck } from "lucide-react";
import { apiFetch } from "@/lib/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/brand/states";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type BadgeVariant = "default" | "secondary" | "success" | "warning" | "destructive" | "outline";

export interface CustomerRow {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  country: string | null;
  status: string;
  kycStatus: string;
  emailVerified: boolean;
  riskScore: number | null;
  riskLevel: string | null;
  createdAt: string;
}

interface ApiResponse {
  customers: {
    id: string;
    email: string;
    status: string;
    kycStatus: string;
    emailVerified: boolean;
    createdAt: string;
    profile: { firstName: string; lastName: string; country: string | null } | null;
    riskScore: { score: number; level: string } | null;
  }[];
  total: number;
  take: number;
  skip: number;
}

function kycVariant(status: string): BadgeVariant {
  switch (status) {
    case "APPROVED":
      return "success";
    case "REJECTED":
      return "destructive";
    case "IN_REVIEW":
    case "PENDING":
      return "warning";
    default:
      return "secondary";
  }
}

function statusVariant(status: string): BadgeVariant {
  switch (status) {
    case "ACTIVE":
      return "success";
    case "SUSPENDED":
      return "warning";
    case "BLOCKED":
    case "CLOSED":
      return "destructive";
    default:
      return "secondary";
  }
}

function riskVariant(level: string | null): BadgeVariant {
  switch (level) {
    case "LOW":
      return "success";
    case "MEDIUM":
      return "warning";
    case "HIGH":
    case "CRITICAL":
      return "destructive";
    default:
      return "secondary";
  }
}

function fullName(r: { firstName: string | null; lastName: string | null; email: string }): string {
  const name = [r.firstName, r.lastName].filter(Boolean).join(" ").trim();
  return name || r.email;
}

function initials(r: { firstName: string | null; lastName: string | null; email: string }): string {
  const a = r.firstName?.[0] ?? r.email[0] ?? "?";
  const b = r.lastName?.[0] ?? "";
  return `${a}${b}`.toUpperCase();
}

export function CustomersClient({
  initialRows,
  initialQuery,
  page,
  pageSize,
  total,
}: {
  initialRows: CustomerRow[];
  initialQuery: string;
  page: number;
  pageSize: number;
  total: number;
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState(initialQuery);
  const [rows, setRows] = React.useState<CustomerRow[]>(initialRows);
  const [count, setCount] = React.useState(total);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [searched, setSearched] = React.useState(false);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep server-rendered rows when query matches the URL query (page nav).
  React.useEffect(() => {
    setRows(initialRows);
    setCount(total);
    setSearched(false);
    setQuery(initialQuery);
  }, [initialRows, total, initialQuery]);

  const runSearch = React.useCallback(async (q: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      params.set("take", String(pageSize));
      const data = await apiFetch<ApiResponse>(`/api/admin/customers?${params.toString()}`);
      const mapped: CustomerRow[] = data.customers.map((c) => ({
        id: c.id,
        email: c.email,
        firstName: c.profile?.firstName ?? null,
        lastName: c.profile?.lastName ?? null,
        country: c.profile?.country ?? null,
        status: c.status,
        kycStatus: c.kycStatus,
        emailVerified: c.emailVerified,
        riskScore: c.riskScore?.score ?? null,
        riskLevel: c.riskScore?.level ?? null,
        createdAt: c.createdAt,
      }));
      setRows(mapped);
      setCount(data.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }, [pageSize]);

  function onChange(value: string) {
    setQuery(value);
    setSearched(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void runSearch(value.trim()), 300);
  }

  // Pagination only applies to the un-searched (server-paged) view.
  const pageCount = Math.max(1, Math.ceil(count / pageSize));
  const showPagination = !searched && pageCount > 1;
  const from = count === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, count);

  return (
    <Card className="glass-card overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-border/60 bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Search by name or email…"
            className="pl-9"
            aria-label="Search customers"
          />
          {loading && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>
        <span className="text-sm font-medium tabular-nums text-muted-foreground">
          {searched
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
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="p-6">
          <EmptyState
            title="No customers found"
            description={
              searched && query
                ? `No results for “${query}”.`
                : "No customers in the sandbox yet."
            }
          />
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>KYC</TableHead>
              <TableHead>Risk</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Country</TableHead>
              <TableHead className="text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} className="cursor-pointer">
                <TableCell>
                  <Link href={`/admin/customers/${r.id}`} className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-xs font-semibold text-white">
                      {initials(r)}
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 font-medium">
                        {fullName(r)}
                        {r.emailVerified && (
                          <MailCheck className="h-3.5 w-3.5 text-success" aria-label="Email verified" />
                        )}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {r.email}
                      </span>
                    </span>
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant={kycVariant(r.kycStatus)}>{r.kycStatus.replaceAll("_", " ")}</Badge>
                </TableCell>
                <TableCell>
                  {r.riskLevel ? (
                    <Badge variant={riskVariant(r.riskLevel)}>
                      {r.riskLevel}
                      {r.riskScore !== null ? ` · ${r.riskScore}` : ""}
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
                </TableCell>
                <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                  {r.country ?? "—"}
                </TableCell>
                <TableCell className="text-right">
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/admin/customers/${r.id}`}>
                      Open <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {showPagination && (
        <div className="flex items-center justify-between border-t border-border/60 p-4">
          <span className="text-sm text-muted-foreground">
            Page {page} of {pageCount}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => router.push(`/admin/customers?page=${page - 1}`)}
            >
              <ChevronLeft className="h-4 w-4" /> Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pageCount}
              onClick={() => router.push(`/admin/customers?page=${page + 1}`)}
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
