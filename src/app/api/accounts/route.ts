import { route, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AccountOwnerType } from "@prisma/client";

export const GET = route(async () => {
  const user = await requireUser();

  const accounts = await prisma.account.findMany({
    where: {
      userId: user.id,
      ownerType: AccountOwnerType.USER,
      deletedAt: null,
    },
    orderBy: { createdAt: "asc" },
  });

  return ok(accounts);
});
