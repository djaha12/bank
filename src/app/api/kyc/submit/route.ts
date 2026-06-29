import { route, ok, parseBody, getClientContext } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { kycSubmitSchema } from "@/lib/validation";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { notify } from "@/lib/notifications";
import { KycStatus, NotificationType, Prisma, SanctionsOutcome } from "@prisma/client";

export const POST = route(async (req) => {
  const user = await requireUser();
  const ctx = getClientContext(req);
  const body = await parseBody(req, kycSubmitSchema);

  const now = new Date();

  // Upsert customer profile fields from the submission.
  await prisma.customerProfile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      firstName: body.firstName,
      lastName: body.lastName,
      dateOfBirth: new Date(body.dateOfBirth),
      nationality: body.nationality,
      country: body.country,
      addressLine1: body.addressLine1,
      addressLine2: body.addressLine2,
      city: body.city,
      postalCode: body.postalCode,
      occupation: body.occupation,
      sourceOfFunds: body.sourceOfFunds,
    },
    update: {
      firstName: body.firstName,
      lastName: body.lastName,
      dateOfBirth: new Date(body.dateOfBirth),
      nationality: body.nationality,
      country: body.country,
      addressLine1: body.addressLine1,
      addressLine2: body.addressLine2,
      city: body.city,
      postalCode: body.postalCode,
      occupation: body.occupation,
      sourceOfFunds: body.sourceOfFunds,
    },
  });

  const riskQuestionnaire =
    body.riskQuestionnaire !== undefined
      ? (body.riskQuestionnaire as Prisma.InputJsonValue)
      : Prisma.JsonNull;

  // Find the most recent non-decided application to update, else create.
  const existing = await prisma.kycApplication.findFirst({
    where: { userId: user.id, status: { in: [KycStatus.PENDING, KycStatus.IN_REVIEW] } },
    orderBy: { createdAt: "desc" },
  });

  const application = existing
    ? await prisma.kycApplication.update({
        where: { id: existing.id },
        data: {
          status: KycStatus.IN_REVIEW,
          submittedAt: now,
          sourceOfFunds: body.sourceOfFunds,
          declaredPepStatus: body.declaredPepStatus,
          riskQuestionnaire,
        },
      })
    : await prisma.kycApplication.create({
        data: {
          userId: user.id,
          status: KycStatus.IN_REVIEW,
          submittedAt: now,
          sourceOfFunds: body.sourceOfFunds,
          declaredPepStatus: body.declaredPepStatus,
          riskQuestionnaire,
        },
      });

  // Create KYC document rows (sandbox storage references only).
  const documents = body.documents ?? [];
  if (documents.length > 0) {
    await prisma.kycDocument.createMany({
      data: documents.map((doc) => ({
        applicationId: application.id,
        type: doc.type,
        storageRef: `sandbox://${doc.type}`,
        fileName: doc.fileName,
      })),
    });
  }

  // Sandbox sanctions / PEP screening — always CLEAR in the sandbox.
  await prisma.sanctionsScreeningResult.create({
    data: {
      userId: user.id,
      query: `${body.firstName} ${body.lastName}`,
      outcome: SanctionsOutcome.CLEAR,
      matchedList: "SANDBOX-DEMO-LIST",
      score: 0,
    },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { kycStatus: KycStatus.IN_REVIEW },
  });

  await writeAudit({
    actorType: "USER",
    actorId: user.id,
    action: "kyc.submit",
    entity: "KycApplication",
    entityId: application.id,
    after: { status: KycStatus.IN_REVIEW, documents: documents.length },
    ipAddress: ctx.ip,
    userAgent: ctx.userAgent,
  });

  await notify({
    userId: user.id,
    type: NotificationType.KYC,
    title: "Identity verification submitted",
    body: "Your KYC application is now in review. We'll notify you once a decision is made.",
    metadata: { applicationId: application.id },
  });

  return ok(
    {
      application: {
        id: application.id,
        status: application.status,
        submittedAt: application.submittedAt,
      },
      kycStatus: KycStatus.IN_REVIEW,
    },
    201,
  );
});
