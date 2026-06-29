import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Liveness + ledger-integrity probe (used by the admin System Health view and
 * ops). Confirms DB connectivity and that ledger entries conserve value per
 * currency (sum of credits == sum of debits).
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const rows = await prisma.ledgerEntry.groupBy({
      by: ["currency", "direction"],
      _sum: { amount: true },
    });
    const net = new Map<string, bigint>();
    for (const r of rows) {
      const amt = r._sum.amount ?? 0n;
      net.set(r.currency, (net.get(r.currency) ?? 0n) + (r.direction === "CREDIT" ? amt : -amt));
    }
    const ledgerBalanced = [...net.values()].every((v) => v === 0n);
    return NextResponse.json({
      status: "ok",
      sandbox: true,
      time: new Date().toISOString(),
      db: "up",
      ledgerBalanced,
    });
  } catch {
    return NextResponse.json({ status: "degraded", db: "down" }, { status: 503 });
  }
}
