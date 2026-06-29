import { PrismaClient } from "@prisma/client";

// Single PrismaClient instance across hot-reloads in dev.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/**
 * Prisma transaction client type — handy for passing a tx into domain helpers
 * so ledger writes stay atomic.
 */
export type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];
