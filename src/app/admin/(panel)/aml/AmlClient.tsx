"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  UserCheck,
  CheckCircle2,
  Eye,
  Sparkles,
  Link2,
  ShieldAlert,
  NotebookPen,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/client";
import { Currency, RiskLevel } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { MoneyText } from "@/components/brand/money-text";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type BadgeVariant = "default" | "secondary" | "success" | "warning" | "destructive" | "outline";

export interface AmlAlertView {
  id: string;
  userId: string;
  userEmail: string | null;
  ruleCode: string;
  level: RiskLevel;
  status: string;
  reason: string;
  details: { key: string; value: string }[];
  adminNotes: string | null;
  assignedTo: string | null;
  assigneeName: string | null;
  transactionRef: string | null;
  transactionId: string | null;
  transactionAmount: string | null;
  transactionCurrency: Currency | null;
  createdAt: string;
}

interface Group {
  level: RiskLevel;
  items: AmlAlertView[];
}

const LEVEL_META: Record<RiskLevel, { label: string; variant: BadgeVariant; ring: string; dot: string }> = {
  CRITICAL: { label: "Critical", variant: "destructive", ring: "border-destructive/40", dot: "bg-destructive" },
  HIGH: { label: "High", variant: "destructive", ring: "border-destructive/30", dot: "bg-destructive/80" },
  MEDIUM: { label: "Medium", variant: "warning", ring: "border-warning/30", dot: "bg-warning" },
  LOW: { label: "Low", variant: "secondary", ring: "border-border/60", dot: "bg-muted-foreground" },
};

const STATUS_META: Record<string, BadgeVariant> = {
  OPEN: "warning",
  REVIEWING: "default",
  CLOSED: "success",
};

// Suggested investigation steps per rule (local compliance playbook fallback).
const SUGGESTED_STEPS: Record<string, string[]> = {
  LARGE_TRANSACTION: [
    "Confirm the declared source of funds matches the customer's KYC profile.",
    "Review the counterparty and whether the transfer fits expected behaviour.",
    "Request supporting documentation if the amount exceeds the customer's typical range.",
  ],
  MANY_SMALL_TRANSFERS: [
    "Check for structuring — multiple sub-threshold transfers in a short window.",
    "Aggregate the value over 24h/7d and compare to expected activity.",
    "Identify whether transfers funnel to a single counterparty.",
  ],
  HIGH_RISK_COUNTRY: [
    "Verify the counterparty jurisdiction against the sanctions / high-risk list.",
    "Confirm the purpose of the cross-border movement.",
    "Escalate to enhanced due diligence if the corridor is unexpected.",
  ],
  UNUSUAL_MERCHANT: [
    "Review the merchant category code against the customer's normal spend.",
    "Check for card-not-present or high-risk MCC patterns.",
    "Contact the customer if the merchant is inconsistent with their profile.",
  ],
  VELOCITY: [
    "Measure transaction frequency against the customer baseline.",
    "Look for automated or scripted bursts of activity.",
    "Consider a temporary velocity hold pending review.",
  ],
  NEW_DEVICE_LARGE_TRANSFER: [
    "Correlate the device / session with prior trusted logins.",
    "Confirm whether step-up authentication was completed.",
    "Treat as possible account takeover if the device is unrecognised.",
  ],
  FAILED_LOGINS: [
    "Review the failed login pattern and source IPs.",
    "Check whether credentials were ultimately used successfully.",
    "Recommend a security review / password reset for the customer.",
  ],
  ABOVE_NORMAL_BEHAVIOR: [
    "Compare current activity to the customer's 90-day behavioural baseline.",
    "Identify the specific dimension that deviated (amount, frequency, geography).",
    "Document the rationale before closing or escalating.",
  ],
  SANCTIONS_HIT: [
    "Treat as the highest priority — confirm the screening match details.",
    "Freeze further activity pending a definitive true/false-positive decision.",
    "Escalate confirmed matches to the MLRO and file the required report.",
  ],
};

function fmtRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function AmlClient({ grouped, adminId }: { grouped: Group[]; adminId: string }) {
  const visible = grouped.filter((g) => g.items.length > 0);
  return (
    <div className="space-y-8">
      {visible.map((group) => {
        const meta = LEVEL_META[group.level];
        return (
          <section key={group.level} className="space-y-3">
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} />
              <h2 className="text-sm font-semibold uppercase tracking-wide">{meta.label}</h2>
              <Badge variant="outline">{group.items.length}</Badge>
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {group.items.map((alert) => (
                <AlertCard key={alert.id} alert={alert} adminId={adminId} ring={meta.ring} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function AlertCard({
  alert,
  adminId,
  ring,
}: {
  alert: AmlAlertView;
  adminId: string;
  ring: string;
}) {
  const router = useRouter();
  const [notesOpen, setNotesOpen] = React.useState(false);
  const [aiOpen, setAiOpen] = React.useState(false);
  const [notes, setNotes] = React.useState(alert.adminNotes ?? "");
  const [busy, setBusy] = React.useState<null | "REVIEWING" | "CLOSED" | "ASSIGN" | "NOTES">(null);

  const levelMeta = LEVEL_META[alert.level];
  const assignedToMe = alert.assignedTo === adminId;

  async function patch(
    body: { status?: string; adminNotes?: string; assignToSelf?: boolean },
    action: NonNullable<typeof busy>,
    successMsg: string,
  ) {
    setBusy(action);
    try {
      await apiFetch(`/api/admin/aml-alerts/${alert.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      toast.success(successMsg);
      setNotesOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className={`overflow-hidden border ${ring}`}>
      <CardHeader className="border-b border-border/60 bg-muted/20 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-sm font-mono">{alert.ruleCode.replaceAll("_", " ")}</CardTitle>
            <p className="mt-1 truncate text-xs text-muted-foreground">{alert.userEmail ?? "—"}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <Badge variant={levelMeta.variant}>{levelMeta.label}</Badge>
            <Badge variant={STATUS_META[alert.status] ?? "secondary"}>{alert.status}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-4 text-sm">
        <p className="text-foreground/90">{alert.reason}</p>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
          <span>Raised {fmtRelative(alert.createdAt)}</span>
          {alert.transactionId && (
            <Link
              href={`/admin/transactions`}
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              <Link2 className="h-3 w-3" />
              {alert.transactionRef}
              {alert.transactionAmount && alert.transactionCurrency && (
                <>
                  {" · "}
                  <MoneyText amount={alert.transactionAmount} currency={alert.transactionCurrency} />
                </>
              )}
            </Link>
          )}
          {alert.assigneeName && (
            <span className="inline-flex items-center gap-1">
              <UserCheck className="h-3 w-3" /> {alert.assigneeName}
            </span>
          )}
        </div>

        {alert.adminNotes && (
          <div className="rounded-lg border border-border/60 bg-muted/20 p-2.5 text-xs">
            <span className="font-medium text-muted-foreground">Notes: </span>
            {alert.adminNotes}
          </div>
        )}

        <Separator />

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={busy !== null || assignedToMe}
            onClick={() => patch({ assignToSelf: true }, "ASSIGN", "Assigned to you")}
          >
            {busy === "ASSIGN" ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
            {assignedToMe ? "Assigned to you" : "Assign to me"}
          </Button>
          {alert.status !== "REVIEWING" && alert.status !== "CLOSED" && (
            <Button
              variant="secondary"
              size="sm"
              disabled={busy !== null}
              onClick={() => patch({ status: "REVIEWING" }, "REVIEWING", "Marked reviewing")}
            >
              {busy === "REVIEWING" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
              Review
            </Button>
          )}
          {alert.status !== "CLOSED" && (
            <Button
              variant="outline"
              size="sm"
              disabled={busy !== null}
              onClick={() => patch({ status: "CLOSED" }, "CLOSED", "Alert closed")}
            >
              {busy === "CLOSED" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Close
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => setNotesOpen(true)}>
            <NotebookPen className="h-4 w-4" /> Notes
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setAiOpen(true)}>
            <Sparkles className="h-4 w-4" /> AI summary
          </Button>
        </div>
      </CardContent>

      {/* Notes dialog */}
      <Dialog open={notesOpen} onOpenChange={(o) => !busy && setNotesOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Investigation notes</DialogTitle>
            <DialogDescription>
              Notes are recorded against this alert and written to the audit trail.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`notes-${alert.id}`}>Admin notes</Label>
            <Input
              id={`notes-${alert.id}`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. False positive — confirmed salary deposit"
              maxLength={2000}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNotesOpen(false)} disabled={busy !== null}>
              Cancel
            </Button>
            <Button
              variant="gradient"
              disabled={busy !== null}
              onClick={() => patch({ adminNotes: notes.trim() }, "NOTES", "Notes saved")}
            >
              {busy === "NOTES" && <Loader2 className="h-4 w-4 animate-spin" />}
              Save notes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI compliance summary dialog (local fallback) */}
      <Dialog open={aiOpen} onOpenChange={setAiOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" /> AI compliance summary
            </DialogTitle>
            <DialogDescription>
              Grounded summary generated locally from the alert signals (sandbox · mock provider).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-sm">
            <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p>
                <span className="font-medium">{alert.ruleCode.replaceAll("_", " ")}</span> triggered
                a <span className="font-medium">{LEVEL_META[alert.level].label.toLowerCase()}</span>{" "}
                severity alert for {alert.userEmail ?? "this customer"}. {alert.reason}
              </p>
            </div>

            {alert.details.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Signals
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {alert.details.map((d) => (
                    <div key={d.key} className="rounded-lg bg-muted/30 px-3 py-2">
                      <div className="text-xs text-muted-foreground">
                        {d.key.replace(/([a-z])([A-Z])/g, "$1 $2")}
                      </div>
                      <div className="truncate text-sm">{d.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Suggested steps
              </div>
              <ol className="space-y-1.5">
                {(SUGGESTED_STEPS[alert.ruleCode] ?? [
                  "Review the customer's recent activity and KYC profile.",
                  "Document a rationale before closing or escalating.",
                ]).map((step, i) => (
                  <li key={i} className="flex gap-2.5 text-sm">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {i + 1}
                    </span>
                    <span className="text-foreground/90">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setAiOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
