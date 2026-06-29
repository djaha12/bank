import { route, ok, parseBody, getClientContext, Errors } from "@/lib/api";
import { requireAdmin, PERMISSIONS } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { serializeBigInt } from "@/lib/money";
import { writeAudit } from "@/lib/audit";
import { notify } from "@/lib/notifications";
import { kycReviewSchema } from "@/lib/validation";
import { AccountType, Currency, KycStatus } from "@prisma/client";

const DECISION_TO_KYC: Record<"APPROVED" | "REJECTED" | "IN_REVIEW", KycStatus> = {
  APPROVED: KycStatus.APPROVED,
  REJECTED: KycStatus.REJECTED,
  IN_REVIEW: KycStatus.IN_REVIEW,
};

const NEW_ACCOUNT_CURRENCIES: Currency[] = [Currency.KGS, Currency.USD, Currency.EUR];

/** Sandbox last-4 display number (never a real account number / IBAN). */
function randomLast4(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

export const PATCH = route(async (req, ctx) => {
  const admin = await requireAdmin(PERMISSIONS.KYC_REVIEW);
  const { id } = await ctx.params;
  if (!id) throw Errors.validation("KYC application id is required");

  const body = await parseBody(req, kycReviewSchema);

  const application = await prisma.kycApplication.findUnique({
    where: { id },
    include: { user: { include: { profile: true } } },
  });
  if (!application) throw Errors.notFound("KYC application not found");

  const nextKyc = DECISION_TO_KYC[body.decision];
  const userId = application.userId;
  const clientCtx = getClientContext(req);

  const result = await prisma.$transaction(async (tx) => {
    const updatedApp = await tx.kycApplication.update({
      where: { id: application.id },
      data: {
        status: nextKyc,
        reviewerId: admin.id,
        decidedAt: new Date(),
        reviewNotes: body.notes,
        rejectionReason: body.decision === "REJECTED" ? body.rejectionReason : null,
      },
    });

    await tx.user.update({
      where: { id: userId },
      data: { kycStatus: nextKyc },
    });

    const createdAccounts: { id: string; currency: Currency }[] = [];
    if (body.decision === "APPROVED") {
      const existingCount = await tx.account.count({
        where: { userId, ownerType: "USER", deletedAt: null },
      });
      if (existingCount === 0) {
        const profile = application.user.profile;
        const holderName = profile
          ? `${profile.firstName} ${profile.lastName}`.trim()
          : application.user.email;
        for (const currency of NEW_ACCOUNT_CURRENCIES) {
          const account = await tx.account.create({
            data: {
              userId,
              ownerType: "USER",
              type: AccountType.CHECKING,
              currency,
              name: `${currency} Account`,
              displayNumber: randomLast4(),
            },
            select: { id: true, currency: true },
          });
          createdAccounts.push(account);
        }
      }
    }

    await writeAudit(
      {
        actorType: "ADMIN",
        actorId: admin.id,
        action: "kyc.review",
        entity: "KycApplication",
        entityId: application.id,
        before: { status: application.status, userKyc: application.user.kycStatus },
        after: {
          status: updatedApp.status,
          decision: body.decision,
          createdAccountIds: createdAccounts.map((a) => a.id),
        },
        metadata: { notes: body.notes ?? null, rejectionReason: body.rejectionReason ?? null },
        ipAddress: clientCtx.ip,
        userAgent: clientCtx.userAgent,
      },
      tx,
    );

    await notify(
      {
        userId,
        type: "KYC",
        title:
          body.decision === "APPROVED"
            ? "Identity verification approved"
            : body.decision === "REJECTED"
              ? "Identity verification rejected"
              : "Identity verification in review",
        body:
          body.decision === "APPROVED"
            ? "Your identity has been verified. Your accounts are ready to use."
            : body.decision === "REJECTED"
              ? `Your verification was not approved. ${body.rejectionReason ?? ""}`.trim()
              : "Your verification is being reviewed by our team.",
        metadata: { applicationId: application.id, decision: body.decision },
      },
      tx,
    );

    return { application: updatedApp, createdAccounts };
  });

  return ok(
    serializeBigInt({
      id: result.application.id,
      status: result.application.status,
      decidedAt: result.application.decidedAt,
      createdAccounts: result.createdAccounts,
    }),
  );
});
