"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  ShieldCheck,
  ShieldAlert,
  RefreshCcw,
  Loader2,
  CheckCircle2,
  CircleDashed,
  Banknote,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type BadgeVariant = "default" | "secondary" | "success" | "warning" | "destructive" | "outline";

export interface KycApplicationView {
  id: string;
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  nationality: string | null;
  country: string | null;
  dateOfBirth: string | null;
  occupation: string | null;
  status: string;
  sourceOfFunds: string | null;
  declaredPepStatus: boolean;
  submittedAt: string | null;
  questionnaire: { key: string; value: string }[];
  documents: { type: string; fileName: string; verified: boolean }[];
}

type Decision = "APPROVED" | "REJECTED" | "IN_REVIEW";

const DECISION_META: Record<
  Decision,
  { title: string; description: string; cta: string; variant: BadgeVariant }
> = {
  APPROVED: {
    title: "Approve application",
    description:
      "Approving verifies the customer's identity and provisions their KGS, USD and EUR accounts automatically.",
    cta: "Approve & provision",
    variant: "success",
  },
  REJECTED: {
    title: "Reject application",
    description: "The customer will be notified that verification was not approved.",
    cta: "Reject",
    variant: "destructive",
  },
  IN_REVIEW: {
    title: "Request more information",
    description: "Move the application to in-review and request additional documents from the customer.",
    cta: "Request more",
    variant: "warning",
  },
};

function statusVariant(status: string): BadgeVariant {
  switch (status) {
    case "APPROVED":
      return "success";
    case "REJECTED":
      return "destructive";
    case "IN_REVIEW":
      return "warning";
    default:
      return "secondary";
  }
}

function humanLabel(key: string): string {
  return key
    .replace(/[_-]/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^\w/, (c) => c.toUpperCase());
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

export function KycReviewClient({ application }: { application: KycApplicationView }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [decision, setDecision] = React.useState<Decision>("APPROVED");
  const [notes, setNotes] = React.useState("");
  const [rejectionReason, setRejectionReason] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const name =
    [application.firstName, application.lastName].filter(Boolean).join(" ").trim() ||
    application.email;
  const initials =
    (application.firstName?.[0] ?? application.email[0] ?? "?").toUpperCase() +
    (application.lastName?.[0] ?? "").toUpperCase();

  function start(d: Decision) {
    setDecision(d);
    setNotes("");
    setRejectionReason("");
    setOpen(true);
  }

  async function submit() {
    if (decision === "REJECTED" && !rejectionReason.trim()) {
      toast.error("A rejection reason is required.");
      return;
    }
    setSubmitting(true);
    try {
      const body: Record<string, string> = { decision };
      if (notes.trim()) body.notes = notes.trim();
      if (decision === "REJECTED") body.rejectionReason = rejectionReason.trim();
      const res = await apiFetch<{ createdAccounts: { id: string; currency: string }[] }>(
        `/api/admin/kyc/${application.id}/review`,
        { method: "PATCH", body: JSON.stringify(body) },
      );
      if (decision === "APPROVED") {
        const n = res.createdAccounts?.length ?? 0;
        toast.success(
          n > 0
            ? `${name} approved — ${n} account${n === 1 ? "" : "s"} provisioned.`
            : `${name} approved.`,
        );
      } else if (decision === "REJECTED") {
        toast.success(`${name}'s application rejected.`);
      } else {
        toast.success(`More information requested from ${name}.`);
      }
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Review failed");
    } finally {
      setSubmitting(false);
    }
  }

  const meta = DECISION_META[decision];

  return (
    <Card className="glass-card lift overflow-hidden">
      <CardHeader className="border-b border-border/60 bg-muted/20">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-gradient text-sm font-semibold text-white shadow-glow ring-1 ring-white/10">
              {initials}
            </span>
            <div>
              <CardTitle className="font-display text-base">{name}</CardTitle>
              <p className="text-xs text-muted-foreground">{application.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {application.declaredPepStatus && (
              <Badge variant="warning" className="gap-1">
                <AlertTriangle className="h-3 w-3" /> PEP
              </Badge>
            )}
            <Badge variant={statusVariant(application.status)}>
              {application.status.replaceAll("_", " ")}
            </Badge>
            <span className="hidden text-xs text-muted-foreground sm:inline">
              Submitted {fmtDate(application.submittedAt)}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 pt-5">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Applicant facts */}
          <div className="space-y-2.5 rounded-2xl border border-border/60 bg-muted/20 p-4 text-sm">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Applicant
            </div>
            <Detail label="Date of birth" value={fmtDate(application.dateOfBirth)} />
            <Detail label="Nationality" value={application.nationality ?? "—"} />
            <Detail label="Residence" value={application.country ?? "—"} />
            <Detail label="Occupation" value={application.occupation ?? "—"} />
          </div>

          {/* Source of funds + questionnaire */}
          <div className="space-y-2.5 text-sm lg:col-span-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Banknote className="h-3.5 w-3.5" /> Source of funds & questionnaire
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-sm">
              {application.sourceOfFunds ?? "Not declared"}
            </div>
            {application.questionnaire.length > 0 ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {application.questionnaire.map((q) => (
                  <div
                    key={q.key}
                    className="rounded-xl bg-muted/30 px-3 py-2 ring-1 ring-inset ring-border/40 transition-colors hover:bg-muted/50"
                  >
                    <div className="text-xs text-muted-foreground">{humanLabel(q.key)}</div>
                    <div className="text-sm">{q.value}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No questionnaire on file.</p>
            )}
          </div>
        </div>

        <Separator />

        {/* Documents (mock) */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <FileText className="h-3.5 w-3.5" /> Documents
            <span className="font-normal normal-case text-muted-foreground/70">
              (sandbox — no real binaries stored)
            </span>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {application.documents.map((d) => (
              <div
                key={d.type}
                className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 p-3"
              >
                <div className="flex items-center gap-2.5">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="text-sm font-medium">{d.type.replaceAll("_", " ")}</div>
                    <div className="text-xs text-muted-foreground">{d.fileName}</div>
                  </div>
                </div>
                {d.verified ? (
                  <CheckCircle2 className="h-4 w-4 text-success" aria-label="Verified" />
                ) : (
                  <CircleDashed className="h-4 w-4 text-muted-foreground" aria-label="Unverified" />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={() => start("IN_REVIEW")}>
            <RefreshCcw className="h-4 w-4" /> Request more
          </Button>
          <Button variant="destructive" size="sm" onClick={() => start("REJECTED")}>
            <ShieldAlert className="h-4 w-4" /> Reject
          </Button>
          <Button variant="gradient" size="sm" onClick={() => start("APPROVED")}>
            <ShieldCheck className="h-4 w-4" /> Approve
          </Button>
        </div>
      </CardContent>

      <Dialog open={open} onOpenChange={(o) => !submitting && setOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{meta.title}</DialogTitle>
            <DialogDescription>{meta.description}</DialogDescription>
          </DialogHeader>

          {decision === "APPROVED" && (
            <div className="flex items-start gap-2 rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-success">
              <ExternalLink className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Multi-currency accounts (KGS, USD, EUR) will be provisioned automatically for{" "}
                {name}.
              </span>
            </div>
          )}

          <div className="space-y-4">
            {decision === "REJECTED" && (
              <div className="space-y-2">
                <Label htmlFor={`reject-${application.id}`}>Rejection reason</Label>
                <Input
                  id={`reject-${application.id}`}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. Document mismatch — name does not match passport"
                  maxLength={500}
                  autoFocus
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor={`notes-${application.id}`}>Reviewer notes (optional)</Label>
              <Input
                id={`notes-${application.id}`}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Internal notes for the audit trail"
                maxLength={1000}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              This decision is recorded against your reviewer ID in the audit log and the customer
              is notified.
            </p>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              variant={decision === "REJECTED" ? "destructive" : "gradient"}
              onClick={submit}
              disabled={submitting || (decision === "REJECTED" && !rejectionReason.trim())}
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {meta.cta}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate text-right font-medium">{value}</span>
    </div>
  );
}
