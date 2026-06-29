import { ScrollText, ShieldCheck } from "lucide-react";
import { requirePageAdmin } from "@/lib/page-auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/brand/page-header";
import { AuditClient, type AuditRow } from "./AuditClient";

const PAGE_SIZE = 50;

function parsePage(raw: string | string[] | undefined): number {
  const v = Array.isArray(raw) ? raw[0] : raw;
  const n = v ? Number.parseInt(v, 10) : 1;
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function jsonOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return null;
  }
}

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  await requirePageAdmin();
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const skip = (page - 1) * PAGE_SIZE;

  const [total, logs] = await Promise.all([
    prisma.auditLog.count(),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip,
    }),
  ]);

  const rows: AuditRow[] = logs.map((l) => ({
    id: l.id,
    actorType: l.actorType,
    actorId: l.actorId,
    action: l.action,
    entity: l.entity,
    entityId: l.entityId,
    ipAddress: l.ipAddress,
    userAgent: l.userAgent,
    hash: l.hash,
    prevHash: l.prevHash,
    before: jsonOrNull(l.before),
    after: jsonOrNull(l.after),
    metadata: jsonOrNull(l.metadata),
    createdAt: l.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <>
            Audit <span className="text-gradient">trail</span>
          </>
        }
        description="Tamper-evident, hash-chained record of every privileged action. Newest first."
        actions={
          <span className="inline-flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 px-3 py-1.5 text-sm font-medium text-success backdrop-blur">
            <ShieldCheck className="h-4 w-4" />
            Hash-chained
          </span>
        }
      />
      <AuditClient
        rows={rows}
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        emptyIcon={<ScrollText className="h-6 w-6" />}
      />
    </div>
  );
}
