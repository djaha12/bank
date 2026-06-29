import { FileCheck2, Clock, CheckCircle2, Layers, AlertTriangle } from "lucide-react";
import { requirePageAdmin } from "@/lib/page-auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/brand/page-header";
import { StatCard } from "@/components/brand/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/brand/states";
import { KycStatus } from "@prisma/client";
import { KycReviewClient, type KycApplicationView } from "./KycReviewClient";

/** Sandbox mock documents — we never store real binaries (see schema notes). */
const MOCK_DOC_TYPES = ["PASSPORT", "SELFIE", "PROOF_OF_ADDRESS"] as const;

function toRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

export default async function KycReviewPage() {
  await requirePageAdmin();

  const applications = await prisma.kycApplication.findMany({
    where: { status: { in: [KycStatus.PENDING, KycStatus.IN_REVIEW] } },
    orderBy: [{ status: "asc" }, { submittedAt: "asc" }],
    include: {
      user: { include: { profile: true } },
      documents: true,
    },
  });

  const pendingCount = applications.filter((a) => a.status === KycStatus.PENDING).length;
  const inReviewCount = applications.filter((a) => a.status === KycStatus.IN_REVIEW).length;
  const pepCount = applications.filter((a) => a.declaredPepStatus).length;

  const views: KycApplicationView[] = applications.map((app) => {
    const p = app.user.profile;
    const questionnaire = toRecord(app.riskQuestionnaire);
    const docs =
      app.documents.length > 0
        ? app.documents.map((d) => ({
            type: d.type,
            fileName: d.fileName ?? `${d.type.toLowerCase()}.pdf`,
            verified: d.verified,
          }))
        : MOCK_DOC_TYPES.map((t) => ({
            type: t,
            fileName: `${t.toLowerCase()}-sandbox.pdf`,
            verified: false,
          }));

    return {
      id: app.id,
      userId: app.userId,
      email: app.user.email,
      firstName: p?.firstName ?? null,
      lastName: p?.lastName ?? null,
      nationality: p?.nationality ?? null,
      country: p?.country ?? null,
      dateOfBirth: p?.dateOfBirth ? p.dateOfBirth.toISOString() : null,
      occupation: p?.occupation ?? null,
      status: app.status,
      sourceOfFunds: app.sourceOfFunds ?? p?.sourceOfFunds ?? null,
      declaredPepStatus: app.declaredPepStatus,
      submittedAt: app.submittedAt ? app.submittedAt.toISOString() : null,
      questionnaire: questionnaire
        ? Object.entries(questionnaire).map(([k, v]) => ({
            key: k,
            value: typeof v === "string" ? v : JSON.stringify(v),
          }))
        : [],
      documents: docs,
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <>
            KYC <span className="text-gradient">Review</span>
          </>
        }
        description="Review identity verification applications. Approving provisions the customer's accounts."
        actions={
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-warning/30 bg-warning/10 px-3 py-1.5 text-sm font-medium text-warning backdrop-blur">
              <Clock className="h-4 w-4" />
              <span className="tabular-nums">{pendingCount}</span> pending
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 bg-muted/30 px-3 py-1.5 text-sm font-medium text-muted-foreground backdrop-blur">
              <FileCheck2 className="h-4 w-4" />
              <span className="tabular-nums">{inReviewCount}</span> in review
            </span>
          </div>
        }
      />

      {views.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            accent="violet"
            index={0}
            label="In queue"
            value={views.length.toLocaleString()}
            hint="awaiting a decision"
            icon={<Layers className="h-4 w-4" />}
          />
          <StatCard
            accent="cyan"
            index={1}
            label="New"
            value={pendingCount.toLocaleString()}
            hint="not yet opened"
            icon={<Clock className="h-4 w-4" />}
          />
          <StatCard
            accent="blue"
            index={2}
            label="In review"
            value={inReviewCount.toLocaleString()}
            hint="info requested"
            icon={<FileCheck2 className="h-4 w-4" />}
          />
          <StatCard
            accent="emerald"
            index={3}
            label="PEP flagged"
            value={pepCount.toLocaleString()}
            hint="enhanced due diligence"
            icon={<AlertTriangle className="h-4 w-4" />}
          />
        </div>
      )}

      {views.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="py-4">
            <EmptyState
              title="Queue is clear"
              description="No applications are awaiting review. New submissions will appear here."
              icon={<CheckCircle2 className="h-6 w-6 text-success" />}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          {views.map((v) => (
            <KycReviewClient key={v.id} application={v} />
          ))}
        </div>
      )}
    </div>
  );
}
