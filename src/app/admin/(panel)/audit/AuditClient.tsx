"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Link2,
  Fingerprint,
  User,
  ShieldCheck,
  Cpu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmptyState } from "@/components/brand/states";
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

export interface AuditRow {
  id: string;
  actorType: string;
  actorId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  hash: string | null;
  prevHash: string | null;
  before: string | null;
  after: string | null;
  metadata: string | null;
  createdAt: string;
}

function actorMeta(type: string): { variant: BadgeVariant; icon: React.ReactNode } {
  switch (type) {
    case "ADMIN":
      return { variant: "default", icon: <ShieldCheck className="h-3 w-3" /> };
    case "USER":
      return { variant: "secondary", icon: <User className="h-3 w-3" /> };
    case "SYSTEM":
      return { variant: "outline", icon: <Cpu className="h-3 w-3" /> };
    default:
      return { variant: "secondary", icon: <User className="h-3 w-3" /> };
  }
}

function fmtDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(iso));
}

function truncHash(hash: string | null): string {
  if (!hash) return "—";
  return hash.length > 16 ? `${hash.slice(0, 10)}…${hash.slice(-4)}` : hash;
}

export function AuditClient({
  rows,
  page,
  pageSize,
  total,
  emptyIcon,
}: {
  rows: AuditRow[];
  page: number;
  pageSize: number;
  total: number;
  emptyIcon?: React.ReactNode;
}) {
  const router = useRouter();
  const [active, setActive] = React.useState<AuditRow | null>(null);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-border/60 p-4">
        <span className="text-sm text-muted-foreground">
          Showing {from}–{to} of {total.toLocaleString()}
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Fingerprint className="h-3.5 w-3.5" /> hash(prevHash + payload)
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="p-6">
          <EmptyState
            title="No audit entries"
            description="Privileged actions will be recorded here as they happen."
            icon={emptyIcon}
          />
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Actor</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead className="hidden lg:table-cell">Hash</TableHead>
              <TableHead className="hidden md:table-cell">Time</TableHead>
              <TableHead className="text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const am = actorMeta(r.actorType);
              return (
                <TableRow key={r.id}>
                  <TableCell>
                    <Badge variant={am.variant} className="gap-1">
                      {am.icon}
                      {r.actorType}
                    </Badge>
                    {r.actorId && (
                      <span className="mt-1 block font-mono text-[11px] text-muted-foreground">
                        {r.actorId.slice(0, 8)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs">{r.action}</span>
                  </TableCell>
                  <TableCell className="text-sm">
                    {r.entity}
                    {r.entityId && (
                      <span className="block font-mono text-[11px] text-muted-foreground">
                        {r.entityId.slice(0, 8)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {truncHash(r.hash)}
                    </span>
                  </TableCell>
                  <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                    {fmtDateTime(r.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => setActive(r)}>
                      <Eye className="h-4 w-4" /> Detail
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {pageCount > 1 && (
        <div className="flex items-center justify-between border-t border-border/60 p-4">
          <span className="text-sm text-muted-foreground">
            Page {page} of {pageCount}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => router.push(`/admin/audit?page=${page - 1}`)}
            >
              <ChevronLeft className="h-4 w-4" /> Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pageCount}
              onClick={() => router.push(`/admin/audit?page=${page + 1}`)}
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <Dialog open={active !== null} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-mono text-base">
              {active?.action}
            </DialogTitle>
            <DialogDescription>
              {active && (
                <>
                  {active.actorType} {active.actorId ? `(${active.actorId.slice(0, 8)})` : ""} ·{" "}
                  {active.entity}
                  {active.entityId ? ` ${active.entityId.slice(0, 8)}` : ""} ·{" "}
                  {fmtDateTime(active.createdAt)}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {active && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4 pr-3">
                {/* Hash chain */}
                <div className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
                  <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <Link2 className="h-3.5 w-3.5" /> Tamper-evident chain
                  </div>
                  <HashRow label="prevHash" value={active.prevHash} />
                  <HashRow label="hash" value={active.hash} />
                </div>

                {(active.ipAddress || active.userAgent) && (
                  <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                    {active.ipAddress && (
                      <div className="rounded-lg bg-muted/30 px-3 py-2">
                        <div className="text-muted-foreground">IP address</div>
                        <div className="font-mono">{active.ipAddress}</div>
                      </div>
                    )}
                    {active.userAgent && (
                      <div className="rounded-lg bg-muted/30 px-3 py-2">
                        <div className="text-muted-foreground">User agent</div>
                        <div className="truncate font-mono">{active.userAgent}</div>
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <JsonBlock title="Before" json={active.before} tone="destructive" />
                  <JsonBlock title="After" json={active.after} tone="success" />
                </div>

                {active.metadata && <JsonBlock title="Metadata" json={active.metadata} tone="muted" />}
              </div>
            </ScrollArea>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setActive(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function HashRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-16 shrink-0 text-muted-foreground">{label}</span>
      <code className="min-w-0 flex-1 truncate rounded bg-background/60 px-2 py-1 font-mono">
        {value ?? "— (genesis / unset)"}
      </code>
    </div>
  );
}

function JsonBlock({
  title,
  json,
  tone,
}: {
  title: string;
  json: string | null;
  tone: "success" | "destructive" | "muted";
}) {
  const border =
    tone === "success"
      ? "border-success/30"
      : tone === "destructive"
        ? "border-destructive/30"
        : "border-border/60";
  return (
    <div className={`rounded-lg border ${border} bg-muted/20 p-3`}>
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      {json ? (
        <pre className="overflow-x-auto whitespace-pre-wrap break-words text-[11px] leading-relaxed text-foreground/90">
          {json}
        </pre>
      ) : (
        <span className="text-xs text-muted-foreground">No data</span>
      )}
    </div>
  );
}
