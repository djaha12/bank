import { Users } from "lucide-react";
import { requirePageAdmin } from "@/lib/page-auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/brand/page-header";
import { Prisma } from "@prisma/client";
import { CustomersClient, type CustomerRow } from "./CustomersClient";

const PAGE_SIZE = 25;

function parsePage(raw: string | string[] | undefined): number {
  const v = Array.isArray(raw) ? raw[0] : raw;
  const n = v ? Number.parseInt(v, 10) : 1;
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; page?: string | string[] }>;
}) {
  await requirePageAdmin();
  const sp = await searchParams;
  const rawQ = Array.isArray(sp.q) ? sp.q[0] : sp.q;
  const q = rawQ?.trim() ?? "";
  const page = parsePage(sp.page);
  const skip = (page - 1) * PAGE_SIZE;

  const where: Prisma.UserWhereInput = { deletedAt: null };
  if (q) {
    where.OR = [
      { email: { contains: q, mode: "insensitive" } },
      { profile: { is: { firstName: { contains: q, mode: "insensitive" } } } },
      { profile: { is: { lastName: { contains: q, mode: "insensitive" } } } },
    ];
  }

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip,
      include: {
        profile: { select: { firstName: true, lastName: true, country: true } },
        riskScores: { where: { current: true }, take: 1, select: { score: true, level: true } },
      },
    }),
  ]);

  const rows: CustomerRow[] = users.map((u) => {
    const risk = u.riskScores.length > 0 ? u.riskScores[0] : undefined;
    return {
      id: u.id,
      email: u.email,
      firstName: u.profile?.firstName ?? null,
      lastName: u.profile?.lastName ?? null,
      country: u.profile?.country ?? null,
      status: u.status,
      kycStatus: u.kycStatus,
      emailVerified: u.emailVerified,
      riskScore: risk?.score ?? null,
      riskLevel: risk?.level ?? null,
      createdAt: u.createdAt.toISOString(),
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <>
            Customer <span className="text-gradient">book</span>
          </>
        }
        description="Search and manage every customer in the sandbox book."
        actions={
          <span className="inline-flex items-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-3 py-1.5 text-sm font-medium text-muted-foreground backdrop-blur">
            <Users className="h-4 w-4 text-brand-violet" />
            <span className="tabular-nums text-foreground">{total.toLocaleString()}</span> total
          </span>
        }
      />
      <CustomersClient
        initialRows={rows}
        initialQuery={q}
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
      />
    </div>
  );
}
