"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  UserRound,
  FileText,
  ScanFace,
  MapPin,
  Wallet,
  ClipboardCheck,
  Upload,
  Camera,
  CheckCircle2,
  Clock,
  Search,
  XCircle,
  ShieldCheck,
  Lock,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { KycStatus } from "@prisma/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch } from "@/lib/client";

export interface KycPrefill {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  nationality: string;
  country: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postalCode: string;
  occupation: string;
}

type DocType = "PASSPORT" | "ID_CARD" | "DRIVERS_LICENSE" | "PROOF_OF_ADDRESS" | "SELFIE";
type SourceOfFunds = "SALARY" | "BUSINESS" | "INVESTMENTS" | "SAVINGS" | "OTHER";

interface StatusResponse {
  kycStatus: KycStatus;
  application: { id: string; status: KycStatus; submittedAt: string | null } | null;
  documents: { id: string; type: DocType; fileName: string | null }[];
}

const COUNTRIES: { code: string; name: string }[] = [
  { code: "KG", name: "Kyrgyzstan" },
  { code: "KZ", name: "Kazakhstan" },
  { code: "UZ", name: "Uzbekistan" },
  { code: "TJ", name: "Tajikistan" },
  { code: "RU", name: "Russia" },
  { code: "TR", name: "Türkiye" },
  { code: "GB", name: "United Kingdom" },
  { code: "DE", name: "Germany" },
  { code: "US", name: "United States" },
  { code: "AE", name: "United Arab Emirates" },
];

const SOURCE_OPTIONS: { value: SourceOfFunds; label: string }[] = [
  { value: "SALARY", label: "Salary / employment" },
  { value: "BUSINESS", label: "Business income" },
  { value: "INVESTMENTS", label: "Investments" },
  { value: "SAVINGS", label: "Savings" },
  { value: "OTHER", label: "Other" },
];

const STEPS = [
  { key: "personal", label: "Personal", icon: UserRound },
  { key: "documents", label: "Documents", icon: FileText },
  { key: "selfie", label: "Liveness", icon: ScanFace },
  { key: "address", label: "Address", icon: MapPin },
  { key: "funds", label: "Funds & risk", icon: Wallet },
  { key: "review", label: "Review", icon: ClipboardCheck },
] as const;

// --- Status banner ----------------------------------------------------------

function StatusBanner({ status, onRefresh, refreshing }: { status: KycStatus; onRefresh: () => void; refreshing: boolean }) {
  const config: Record<
    KycStatus,
    { tone: string; icon: React.ReactNode; title: string; body: string }
  > = {
    NOT_STARTED: {
      tone: "border-border/60 bg-card/60",
      icon: <Sparkles className="h-5 w-5 text-primary" />,
      title: "Let's verify your identity",
      body: "Complete the steps below to activate your account. It takes about 3 minutes.",
    },
    PENDING: {
      tone: "border-warning/30 bg-warning/5",
      icon: <Clock className="h-5 w-5 text-warning" />,
      title: "Verification in progress",
      body: "You've started verification. Finish the remaining steps and submit when ready.",
    },
    IN_REVIEW: {
      tone: "border-primary/30 bg-primary/5",
      icon: <Search className="h-5 w-5 text-primary" />,
      title: "Under review",
      body: "Thanks — your documents are with our team. We'll notify you once a decision is made.",
    },
    APPROVED: {
      tone: "border-success/30 bg-success/5",
      icon: <CheckCircle2 className="h-5 w-5 text-success" />,
      title: "You're verified",
      body: "Your identity is confirmed. You can now move money, open cards and access higher limits.",
    },
    REJECTED: {
      tone: "border-destructive/30 bg-destructive/5",
      icon: <XCircle className="h-5 w-5 text-destructive" />,
      title: "Verification needs attention",
      body: "We couldn't approve your last submission. Review your details and submit again.",
    },
  };
  const c = config[status];
  return (
    <div className={`flex items-start justify-between gap-4 rounded-xl border p-4 ${c.tone}`}>
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-background/60 p-2">{c.icon}</div>
        <div>
          <div className="text-sm font-semibold">{c.title}</div>
          <p className="mt-0.5 text-xs text-muted-foreground">{c.body}</p>
        </div>
      </div>
      <Button variant="ghost" size="sm" onClick={onRefresh} disabled={refreshing} aria-label="Refresh status">
        <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
      </Button>
    </div>
  );
}

// --- Stepper ----------------------------------------------------------------

function Stepper({ current }: { current: number }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const done = i < current;
          const active = i === current;
          return (
            <React.Fragment key={s.key}>
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${
                    done
                      ? "border-success bg-success/15 text-success"
                      : active
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border/60 bg-muted text-muted-foreground"
                  }`}
                >
                  {done ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </div>
                <span
                  className={`hidden text-[11px] sm:block ${
                    active ? "font-medium text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`mx-1 h-0.5 flex-1 rounded-full ${i < current ? "bg-success" : "bg-border/60"}`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
      <Progress value={((current + 1) / STEPS.length) * 100} />
    </div>
  );
}

// --- Main client ------------------------------------------------------------

export function KycClient({ prefill, initialStatus }: { prefill: KycPrefill; initialStatus: KycStatus }) {
  const [status, setStatus] = React.useState<KycStatus>(initialStatus);
  const [refreshing, setRefreshing] = React.useState(false);
  const [started, setStarted] = React.useState(false);
  const [step, setStep] = React.useState(0);
  const [submitting, setSubmitting] = React.useState(false);

  // Form state
  const [form, setForm] = React.useState({
    firstName: prefill.firstName,
    lastName: prefill.lastName,
    dateOfBirth: prefill.dateOfBirth,
    nationality: prefill.nationality || "KG",
    country: prefill.country || "KG",
    addressLine1: prefill.addressLine1,
    addressLine2: prefill.addressLine2,
    city: prefill.city,
    postalCode: prefill.postalCode,
    occupation: prefill.occupation,
    sourceOfFunds: "SALARY" as SourceOfFunds,
    declaredPepStatus: false,
  });

  // Document mock — capture filenames only, no real upload.
  const [docs, setDocs] = React.useState<Record<DocType, string | null>>({
    PASSPORT: null,
    ID_CARD: null,
    DRIVERS_LICENSE: null,
    PROOF_OF_ADDRESS: null,
    SELFIE: null,
  });
  const [selfieCaptured, setSelfieCaptured] = React.useState(false);

  // Risk questionnaire
  const [risk, setRisk] = React.useState({
    monthlyVolume: "UNDER_1K",
    expectsInternational: false,
    highRiskBusiness: false,
  });

  const isTerminal = status === KycStatus.IN_REVIEW || status === KycStatus.APPROVED;

  const setField = React.useCallback(
    (key: keyof typeof form, value: string | boolean) =>
      setForm((f) => ({ ...f, [key]: value })),
    [],
  );

  async function refreshStatus() {
    setRefreshing(true);
    try {
      const res = await apiFetch<StatusResponse>("/api/kyc/status");
      setStatus(res.kycStatus);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not refresh status");
    } finally {
      setRefreshing(false);
    }
  }

  async function start() {
    setRefreshing(true);
    try {
      const res = await apiFetch<{ kycStatus: KycStatus }>("/api/kyc/start", { method: "POST" });
      setStatus(res.kycStatus);
      setStarted(true);
      setStep(0);
      toast.success("Verification started", { description: "Let's get you set up." });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start verification");
    } finally {
      setRefreshing(false);
    }
  }

  // --- Per-step validation ---------------------------------------------------
  function validateStep(i: number): string | null {
    if (i === 0) {
      if (!form.firstName.trim() || !form.lastName.trim()) return "Enter your full legal name";
      if (!form.dateOfBirth) return "Enter your date of birth";
      if (form.nationality.length !== 2) return "Select your nationality";
    }
    if (i === 1) {
      const hasId = docs.PASSPORT || docs.ID_CARD || docs.DRIVERS_LICENSE;
      if (!hasId) return "Add at least one identity document";
    }
    if (i === 2) {
      if (!selfieCaptured) return "Capture a selfie to continue";
    }
    if (i === 3) {
      if (!form.addressLine1.trim()) return "Enter your address";
      if (!form.city.trim()) return "Enter your city";
      if (!form.postalCode.trim()) return "Enter your postal code";
      if (form.country.length !== 2) return "Select your country of residence";
    }
    return null;
  }

  function next() {
    const err = validateStep(step);
    if (err) {
      toast.error(err);
      return;
    }
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }

  function back() {
    setStep((s) => Math.max(0, s - 1));
  }

  async function submit() {
    // Final guard across all steps.
    for (let i = 0; i <= 3; i++) {
      const err = validateStep(i);
      if (err) {
        toast.error(err);
        setStep(i);
        return;
      }
    }
    setSubmitting(true);
    try {
      const documents: { type: DocType; fileName: string }[] = [];
      (Object.keys(docs) as DocType[]).forEach((type) => {
        const fileName = docs[type];
        if (fileName) documents.push({ type, fileName });
      });
      if (selfieCaptured) documents.push({ type: "SELFIE", fileName: "liveness-capture.jpg" });

      const res = await apiFetch<{ kycStatus: KycStatus }>("/api/kyc/submit", {
        method: "POST",
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          dateOfBirth: form.dateOfBirth,
          nationality: form.nationality,
          country: form.country,
          addressLine1: form.addressLine1.trim(),
          addressLine2: form.addressLine2.trim() || undefined,
          city: form.city.trim(),
          postalCode: form.postalCode.trim(),
          occupation: form.occupation.trim() || "Not specified",
          sourceOfFunds: form.sourceOfFunds,
          declaredPepStatus: form.declaredPepStatus,
          riskQuestionnaire: {
            monthlyVolume: risk.monthlyVolume,
            expectsInternational: risk.expectsInternational,
            highRiskBusiness: risk.highRiskBusiness,
          },
          documents,
        }),
      });
      setStatus(res.kycStatus);
      setStarted(false);
      toast.success("Verification submitted", {
        description: "Your application is now in review.",
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit verification");
    } finally {
      setSubmitting(false);
    }
  }

  // --- Render ----------------------------------------------------------------

  const showWizard = started && !isTerminal;

  return (
    <div className="space-y-6">
      <StatusBanner status={status} onRefresh={refreshStatus} refreshing={refreshing} />

      {/* Trust strip */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-border/60 bg-card/40 px-4 py-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Lock className="h-3.5 w-3.5 text-success" /> Bank-grade encryption
        </span>
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-success" /> Sandbox — no real documents stored
        </span>
        <span className="inline-flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-success" /> You can stop and resume anytime
        </span>
      </div>

      {!showWizard ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            {status === KycStatus.APPROVED ? (
              <>
                <div className="rounded-full bg-success/15 p-4">
                  <CheckCircle2 className="h-8 w-8 text-success" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">You&apos;re fully verified</h3>
                  <p className="mt-1 max-w-md text-sm text-muted-foreground">
                    Nothing more to do. Enjoy transfers, cards and higher limits.
                  </p>
                </div>
                <Button asChild variant="outline">
                  <a href="/dashboard">Back to dashboard</a>
                </Button>
              </>
            ) : status === KycStatus.IN_REVIEW ? (
              <>
                <div className="rounded-full bg-primary/15 p-4">
                  <Search className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">We&apos;re reviewing your application</h3>
                  <p className="mt-1 max-w-md text-sm text-muted-foreground">
                    This usually takes a moment in the sandbox. Tap refresh to check for updates.
                  </p>
                </div>
                <Button variant="outline" onClick={refreshStatus} disabled={refreshing}>
                  <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Check status
                </Button>
              </>
            ) : (
              <>
                <div className="rounded-full bg-primary/15 p-4">
                  <ScanFace className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">
                    {status === KycStatus.REJECTED ? "Try verification again" : "Verify your identity"}
                  </h3>
                  <p className="mt-1 max-w-md text-sm text-muted-foreground">
                    Six quick steps: your details, a document, a quick liveness check, your address and a
                    couple of compliance questions.
                  </p>
                </div>
                <Button variant="gradient" size="lg" onClick={start} disabled={refreshing}>
                  {refreshing ? "Starting…" : "Start verification"} <ArrowRight className="h-4 w-4" />
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <Stepper current={step} />
          </CardHeader>
          <CardContent className="space-y-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ type: "spring", stiffness: 200, damping: 24 }}
                className="space-y-5"
              >
                {step === 0 && (
                  <StepShell
                    icon={<UserRound className="h-5 w-5 text-primary" />}
                    title="Personal information"
                    description="Use your details exactly as they appear on your ID."
                  >
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <FieldInput
                        id="firstName"
                        label="Legal first name"
                        value={form.firstName}
                        onChange={(v) => setField("firstName", v)}
                      />
                      <FieldInput
                        id="lastName"
                        label="Legal last name"
                        value={form.lastName}
                        onChange={(v) => setField("lastName", v)}
                      />
                      <div className="space-y-2">
                        <Label htmlFor="dob">Date of birth</Label>
                        <Input
                          id="dob"
                          type="date"
                          value={form.dateOfBirth}
                          onChange={(e) => setField("dateOfBirth", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Nationality</Label>
                        <Select value={form.nationality} onValueChange={(v) => setField("nationality", v)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            {COUNTRIES.map((c) => (
                              <SelectItem key={c.code} value={c.code}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </StepShell>
                )}

                {step === 1 && (
                  <StepShell
                    icon={<FileText className="h-5 w-5 text-primary" />}
                    title="Upload a document"
                    description="Add one government ID. Files aren't really uploaded in the sandbox — we only record the name."
                  >
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <DocUpload
                        label="Passport"
                        type="PASSPORT"
                        fileName={docs.PASSPORT}
                        onPick={(name) => setDocs((d) => ({ ...d, PASSPORT: name }))}
                      />
                      <DocUpload
                        label="National ID card"
                        type="ID_CARD"
                        fileName={docs.ID_CARD}
                        onPick={(name) => setDocs((d) => ({ ...d, ID_CARD: name }))}
                      />
                      <DocUpload
                        label="Driver's licence"
                        type="DRIVERS_LICENSE"
                        fileName={docs.DRIVERS_LICENSE}
                        onPick={(name) => setDocs((d) => ({ ...d, DRIVERS_LICENSE: name }))}
                      />
                      <DocUpload
                        label="Proof of address"
                        type="PROOF_OF_ADDRESS"
                        fileName={docs.PROOF_OF_ADDRESS}
                        onPick={(name) => setDocs((d) => ({ ...d, PROOF_OF_ADDRESS: name }))}
                      />
                    </div>
                  </StepShell>
                )}

                {step === 2 && (
                  <StepShell
                    icon={<ScanFace className="h-5 w-5 text-primary" />}
                    title="Liveness check"
                    description="Position your face in the frame. This is a mock — no camera is accessed."
                  >
                    <div className="flex flex-col items-center gap-4">
                      <div
                        className={`relative flex h-56 w-56 items-center justify-center overflow-hidden rounded-full border-2 ${
                          selfieCaptured ? "border-success bg-success/5" : "border-dashed border-primary/40 bg-muted/40"
                        }`}
                      >
                        {/* animated framing ring */}
                        <div className="absolute inset-3 rounded-full border border-primary/30" />
                        {selfieCaptured ? (
                          <motion.div
                            initial={{ scale: 0.6, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ type: "spring", stiffness: 240, damping: 18 }}
                            className="flex flex-col items-center gap-2 text-success"
                          >
                            <CheckCircle2 className="h-12 w-12" />
                            <span className="text-sm font-medium">Captured</span>
                          </motion.div>
                        ) : (
                          <div className="flex flex-col items-center gap-2 text-muted-foreground">
                            <ScanFace className="h-12 w-12" />
                            <span className="text-xs">Centre your face</span>
                          </div>
                        )}
                      </div>
                      {selfieCaptured ? (
                        <Button
                          variant="outline"
                          onClick={() => setSelfieCaptured(false)}
                        >
                          <RefreshCw className="h-4 w-4" /> Retake
                        </Button>
                      ) : (
                        <Button
                          variant="gradient"
                          onClick={() => {
                            setSelfieCaptured(true);
                            toast.success("Liveness check passed");
                          }}
                        >
                          <Camera className="h-4 w-4" /> Capture
                        </Button>
                      )}
                      <p className="max-w-sm text-center text-xs text-muted-foreground">
                        In production this runs an on-device liveness model. Nothing is recorded here.
                      </p>
                    </div>
                  </StepShell>
                )}

                {step === 3 && (
                  <StepShell
                    icon={<MapPin className="h-5 w-5 text-primary" />}
                    title="Residential address"
                    description="Where you currently live. Used for compliance and statements."
                  >
                    <div className="space-y-4">
                      <FieldInput
                        id="addr1"
                        label="Address line 1"
                        value={form.addressLine1}
                        onChange={(v) => setField("addressLine1", v)}
                      />
                      <FieldInput
                        id="addr2"
                        label="Address line 2 (optional)"
                        value={form.addressLine2}
                        onChange={(v) => setField("addressLine2", v)}
                      />
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <FieldInput
                          id="city"
                          label="City"
                          value={form.city}
                          onChange={(v) => setField("city", v)}
                        />
                        <FieldInput
                          id="postal"
                          label="Postal code"
                          value={form.postalCode}
                          onChange={(v) => setField("postalCode", v)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Country of residence</Label>
                        <Select value={form.country} onValueChange={(v) => setField("country", v)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            {COUNTRIES.map((c) => (
                              <SelectItem key={c.code} value={c.code}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </StepShell>
                )}

                {step === 4 && (
                  <StepShell
                    icon={<Wallet className="h-5 w-5 text-primary" />}
                    title="Source of funds & risk"
                    description="A few compliance questions. Honest answers keep your account safe."
                  >
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="occupation">Occupation</Label>
                        <Input
                          id="occupation"
                          value={form.occupation}
                          maxLength={120}
                          placeholder="e.g. Software engineer"
                          onChange={(e) => setField("occupation", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Primary source of funds</Label>
                        <Select
                          value={form.sourceOfFunds}
                          onValueChange={(v) => setField("sourceOfFunds", v)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SOURCE_OPTIONS.map((o) => (
                              <SelectItem key={o.value} value={o.value}>
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Expected monthly volume</Label>
                        <Select
                          value={risk.monthlyVolume}
                          onValueChange={(v) => setRisk((r) => ({ ...r, monthlyVolume: v }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="UNDER_1K">Under 1,000</SelectItem>
                            <SelectItem value="1K_10K">1,000 – 10,000</SelectItem>
                            <SelectItem value="10K_50K">10,000 – 50,000</SelectItem>
                            <SelectItem value="OVER_50K">Over 50,000</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <RiskToggle
                        label="I expect to send or receive international transfers"
                        checked={risk.expectsInternational}
                        onChange={(v) => setRisk((r) => ({ ...r, expectsInternational: v }))}
                      />
                      <RiskToggle
                        label="My funds relate to a high-risk industry (e.g. crypto, gambling)"
                        checked={risk.highRiskBusiness}
                        onChange={(v) => setRisk((r) => ({ ...r, highRiskBusiness: v }))}
                      />
                      <RiskToggle
                        label="I am a politically exposed person (PEP) or related to one"
                        checked={form.declaredPepStatus}
                        onChange={(v) => setField("declaredPepStatus", v)}
                      />
                    </div>
                  </StepShell>
                )}

                {step === 5 && (
                  <StepShell
                    icon={<ClipboardCheck className="h-5 w-5 text-primary" />}
                    title="Review & submit"
                    description="Check everything looks right before you send it to our team."
                  >
                    <div className="space-y-4">
                      <ReviewGroup title="Personal">
                        <ReviewRow label="Name" value={`${form.firstName} ${form.lastName}`.trim() || "—"} />
                        <ReviewRow label="Date of birth" value={form.dateOfBirth || "—"} />
                        <ReviewRow
                          label="Nationality"
                          value={COUNTRIES.find((c) => c.code === form.nationality)?.name ?? form.nationality}
                        />
                      </ReviewGroup>
                      <ReviewGroup title="Documents">
                        <ReviewRow
                          label="Identity document"
                          value={docs.PASSPORT ?? docs.ID_CARD ?? docs.DRIVERS_LICENSE ?? "—"}
                        />
                        <ReviewRow label="Proof of address" value={docs.PROOF_OF_ADDRESS ?? "Not provided"} />
                        <ReviewRow
                          label="Liveness selfie"
                          value={selfieCaptured ? "Captured" : "Missing"}
                        />
                      </ReviewGroup>
                      <ReviewGroup title="Address">
                        <ReviewRow
                          label="Address"
                          value={
                            [form.addressLine1, form.city, form.postalCode].filter(Boolean).join(", ") || "—"
                          }
                        />
                        <ReviewRow
                          label="Country"
                          value={COUNTRIES.find((c) => c.code === form.country)?.name ?? form.country}
                        />
                      </ReviewGroup>
                      <ReviewGroup title="Funds & risk">
                        <ReviewRow
                          label="Source of funds"
                          value={SOURCE_OPTIONS.find((o) => o.value === form.sourceOfFunds)?.label ?? "—"}
                        />
                        <ReviewRow label="PEP declared" value={form.declaredPepStatus ? "Yes" : "No"} />
                      </ReviewGroup>
                      <p className="text-xs text-muted-foreground">
                        By submitting you confirm the information is accurate. Sandbox applications are
                        screened automatically and never use real documents.
                      </p>
                    </div>
                  </StepShell>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Nav controls */}
            <div className="flex items-center justify-between border-t border-border/60 pt-5">
              <Button variant="ghost" onClick={back} disabled={step === 0 || submitting}>
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              {step < STEPS.length - 1 ? (
                <Button variant="gradient" onClick={next}>
                  Continue <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button variant="gradient" onClick={submit} disabled={submitting}>
                  {submitting ? "Submitting…" : "Submit for review"} <ShieldCheck className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// --- Sub-components ----------------------------------------------------------

function StepShell({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-primary/10 p-2">{icon}</div>
        <div>
          <h3 className="text-base font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function FieldInput({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} maxLength={200} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function DocUpload({
  label,
  type,
  fileName,
  onPick,
}: {
  label: string;
  type: DocType;
  fileName: string | null;
  onPick: (name: string | null) => void;
}) {
  const inputId = `doc-${type}`;
  return (
    <div
      className={`rounded-xl border p-4 transition-colors ${
        fileName ? "border-success/40 bg-success/5" : "border-dashed border-border/60"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        {fileName && <CheckCircle2 className="h-4 w-4 text-success" />}
      </div>
      {fileName ? (
        <div className="mt-3 space-y-2">
          <p className="truncate text-xs text-muted-foreground" title={fileName}>
            {fileName}
          </p>
          <Button variant="ghost" size="sm" onClick={() => onPick(null)}>
            Remove
          </Button>
        </div>
      ) : (
        <div className="mt-3">
          <input
            id={inputId}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              // Capture only the filename — no real upload happens.
              if (f) onPick(f.name);
            }}
          />
          <Button asChild variant="outline" size="sm">
            <label htmlFor={inputId} className="cursor-pointer">
              <Upload className="h-4 w-4" /> Choose file
            </label>
          </Button>
        </div>
      )}
    </div>
  );
}

function RiskToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border/60 p-4">
      <span className="text-sm">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </div>
  );
}

function ReviewGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/60 p-4">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
      <dl className="space-y-1.5">{children}</dl>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
