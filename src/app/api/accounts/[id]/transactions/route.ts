import { NextResponse } from "next/server";
import { route, ok, Errors } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { fromMinorUnits } from "@/lib/money";

const MAX_TAKE = 100;
const DEFAULT_TAKE = 25;

function parseTake(raw: string | null): number {
  if (!raw) return DEFAULT_TAKE;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_TAKE;
  return Math.min(n, MAX_TAKE);
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export const GET = route(async (req, ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;

  const account = await prisma.account.findUnique({ where: { id } });
  if (!account || account.userId !== user.id || account.deletedAt) {
    throw Errors.notFound("Account not found");
  }

  const url = new URL(req.url);
  const format = url.searchParams.get("format");

  // CSV export: full ledger history for the account, oldest-first.
  if (format === "csv") {
    const rows = await prisma.ledgerEntry.findMany({
      where: { accountId: account.id },
      orderBy: { createdAt: "asc" },
      include: { transaction: { select: { type: true } } },
    });

    const header = "date,type,direction,amount,balanceAfter";
    const lines = rows.map((row) =>
      [
        csvCell(row.createdAt.toISOString()),
        csvCell(row.transaction.type),
        csvCell(row.direction),
        csvCell(fromMinorUnits(row.amount, row.currency)),
        csvCell(fromMinorUnits(row.balanceAfter, row.currency)),
      ].join(","),
    );
    const body = [header, ...lines].join("\n");

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="account-${account.id}-transactions.csv"`,
      },
    });
  }

  // JSON: paginated ledger entries joined to their transaction, newest-first.
  const take = parseTake(url.searchParams.get("take"));
  const cursor = url.searchParams.get("cursor");

  const entries = await prisma.ledgerEntry.findMany({
    where: { accountId: account.id },
    orderBy: { createdAt: "desc" },
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      transaction: {
        select: {
          id: true,
          type: true,
          status: true,
          description: true,
          reference: true,
          createdAt: true,
        },
      },
    },
  });

  const hasMore = entries.length > take;
  const page = hasMore ? entries.slice(0, take) : entries;
  const last = page.length > 0 ? page[page.length - 1] : undefined;
  const nextCursor = hasMore && last ? last.id : null;

  return ok({ entries: page, nextCursor, hasMore });
});
