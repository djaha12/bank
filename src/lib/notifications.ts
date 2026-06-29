import { NotificationType, Prisma } from "@prisma/client";
import { prisma, type Tx } from "@/lib/db";

export async function notify(
  input: {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    metadata?: Prisma.InputJsonValue;
  },
  client: Tx | typeof prisma = prisma,
) {
  return client.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      metadata: input.metadata,
    },
  });
}
