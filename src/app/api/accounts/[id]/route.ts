import { route, ok, Errors } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { HoldStatus } from "@prisma/client";

export const GET = route(async (_req, ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;

  const account = await prisma.account.findUnique({
    where: { id },
    include: {
      holds: {
        where: { status: HoldStatus.HELD },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });

  if (!account || account.userId !== user.id || account.deletedAt) {
    throw Errors.notFound("Account not found");
  }

  return ok(account);
});
