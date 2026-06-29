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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

function StatusBanner({
  status,
  onRefresh,
  refreshing,
}: {
  status: KycStatus;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const config: Record<
    KycStatus,
    {
      ring: string;
      wash: string;
      chip: string;
      icon: React.ReactNode;
      title: string;
      body: string;
    }
  > = {
    NOT_STARTED: {
      ring: "border-border/60",
      wash: "from-brand-violet/15",
      chip: "bg-primary/15 text-primary ring-primary/20",
      icon: <Sparkles className="h-5 w-5" />,
      title: "Let's verify your identity",
      body: "Complete the steps below to activate your account. It takes about 3 minutes.",
    },
    PENDING: {
      ring: "border-warning/30",
      wash: "from-warning/15",
      chip: "bg-warning/15 text-warning ring-warning/25",
      icon: <Clock className="h-5 w-5" />,
      title: "Verification in progress",
      body: "You've started verification. Finish the remaining steps and submit when ready.",
    },
    IN_REVIEW: {
      ring: "border-primary/30",
      wash: "from-brand-cyan/15",
      chip: "bg-primary/15 text-primary ring-primary/20",
      icon: <Search className="h-5 w-5" />,
      title: "Under review",
      body: "Thanks — your documents are with our team. We'll notify you once a decision is made.",
    },
    APPROVED: {
      ring: "border-success/30",
      wash: "from-brand-emerald/20",
      chip: "bg-success/15 text-success ring-success/25",
      icon: <CheckCircle2 className="h-5 w-5" />,
      title: "You're verified",
      body: "Your identity is confirmed. You can now move money, open cards and access higher limits.",
    },
    REJECTED: {
      ring: "border-destructive/30",
      wash: "from-destructive/15",
      chip: "bg-destructive/15 text-destructive ring-destructive/25",
      icon: <XCircle className="h-5 w-5" />,
      title: "Verification needs attention",
      body: "We couldn't approve your last submission. Review your details and submit again.",
    },
  };
  const c = config[status];
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className={`glass-card relative flex items-start justify-between gap-4 overflow-hidden rounded-3xl border p-5 ${c.ring}`}
    >
      <div
        className={`pointer-events-none absolute -left-20 -top-20 h-52 w-52 rounded-full bg-gradient-to-br ${c.wash} to-transparent opacity-80 blur-2xl`}
      />
      <div className="relative flex items-start gap-3.5">
        <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ring-1 ${c.chip}`}>
          {c.icon}
        </div>
        <div>
          <div className="font-display text-base font-semibold tracking-tight">{c.title}</div>
          <p className="mt-0.5 max-w-xl text-sm text-muted-foreground">{c.body}</p>
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onRefresh}
        disabled={refreshing}
        aria-label="Refresh status"
        className="relative shrink-0"
      >
        <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
      </Button>
    </motion.div>
  );
}

// --- Stepper ----------------------------------------------------------------

function Stepper({ current }: { current: number }) {
  const pct = ((current + 1) / STEPS.length) * 100;
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
                  className={`grid h-10 w-10 place-items-center rounded-full border transition-all duration-300 ${
                    done
                      ? "border-success/40 bg-success/15 text-success"
                      : active
                        ? "border-primary/50 bg-primary/15 text-primary shadow-glow ring-1 ring-primary/20"
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
                <div className="mx-1 h-0.5 flex-1 overflow-hidden rounded-full bg-border/60">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      i < current ? "bg-success" : "bg-transparent"
                    }`}
                    style={{ width: i < current ? "100%" : "0%" }}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
      {/* gradient progress rail */}
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted/70">
        <motion.div
          className="h-full rounded-full bg-brand-gradient"
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 22 }}
        />
      </div>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>
          Step {current + 1} of {STEPS.length}
        </span>
        <span className="tabular-nums">{Math.round(pct)}% complete</span>
      </div>
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
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-border/60 bg-card/40 px-4 py-3 text-xs text-muted-foreground backdrop-blur">
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
        <div className="glass-card ring-glow lift relative overflow-hidden rounded-3xl">
          <div className="bg-grid pointer-events-none absolute inset-0 opacity-30" />
          <div className="relative flex flex-col items-center gap-4 px-6 py-14 text-center">
            {status === KycStatus.APPROVED ? (
              <>
                <div className="grid h-16 w-16 place-items-center rounded-2xl bg-success/15 text-success ring-1 ring-success/25">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <div>
                  <h3 className="font-display text-xl font-semibold tracking-tight">
                    You&apos;re fully verified
                  </h3>
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
                <div className="grid h-16 w-16 place-items-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/20">
                  <Search className="h-8 w-8" />
                </div>
                <div>
                  <h3 className="font-display text-xl font-semibold tracking-tight">
                    We&apos;re reviewing your application
                  </h3>
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
                <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-brand-violet/30 to-brand-violet/5 text-brand-violet ring-1 ring-white/10">
                  <ScanFace className="h-8 w-8" />
                </div>
                <div>
                  <h3 className="font-display text-xl font-semibold tracking-tight">
                    {status === KycStatus.REJECTED ? "Try verification again" : "Verify your identity"}
                  </h3>
                  <p className="mt-1 max-w-md text-sm text-muted-foreground">
                    Six quick steps: your details, a document, a quick liveness check, your address and a
                    couple of compliance questions.
                  </p>
                </div>
                <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
                  {STEPS.map((s) => {
                    const Icon = s.icon;
                    return (
                      <span
                        key={s.key}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/40 px-2.5 py-1 text-[11px] text-muted-foreground"
                      >
                        <Icon className="h-3 w-3 text-primary" /> {s.label}
                      </span>
                    );
                  })}
                </div>
                <Button variant="gradient" size="lg" onClick={start} disabled={refreshing} className="mt-2">
                  {refreshing ? "Starting…" : "Start verification"} <ArrowRight className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="glass-card ring-glow relative overflow-hidden rounded-3xl">
          <div className="border-b border-border/60 p-6">
            <Stepper current={step} />
          </div>
          <div className="space-y-6 p-6">
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
                    icon={<UserRound className="h-5 w-5" />}
                    accent="violet"
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
                    icon={<FileText className="h-5 w-5" />}
                    accent="cyan"
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
                    icon={<ScanFace className="h-5 w-5" />}
                    accent="violet"
                    title="Liveness check"
                    description="Position your face in the frame. This is a mock — no camera is accessed."
                  >
                    <div className="flex flex-col items-center gap-5">
                      <div
                        className={`relative grid h-60 w-60 place-items-center rounded-full border-2 transition-colors duration-300 ${
                          selfieCaptured
                            ? "border-success bg-success/5"
                            : "border-dashed border-primary/40 bg-muted/30"
                        }`}
                      >
                        {/* concentric framing rings */}
                        <div className="pointer-events-none absolute inset-4 rounded-full border border-primary/25" />
                        <div className="pointer-events-none absolute inset-8 rounded-full border border-primary/15" />
                        {/* scanning sweep while idle */}
                        {!selfieCaptured && (
                          <motion.div
                            className="pointer-events-none absolute inset-x-6 top-1/2 h-px bg-gradient-to-r from-transparent via-primary to-transparent"
                            initial={{ y: -96, opacity: 0.2 }}
                            animate={{ y: 96, opacity: [0.2, 0.9, 0.2] }}
                            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                          />
                        )}
                        {/* corner brackets */}
                        {(["left-5 top-5 border-l-2 border-t-2", "right-5 top-5 border-r-2 border-t-2", "left-5 bottom-5 border-l-2 border-b-2", "right-5 bottom-5 border-r-2 border-b-2"] as const).map(
                          (pos) => (
                            <span
                              key={pos}
                              className={`pointer-events-none absolute h-6 w-6 rounded-[3px] ${pos} ${
                                selfieCaptured ? "border-success/60" : "border-primary/50"
                              }`}
                            />
                          ),
                        )}
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
                        <Button variant="outline" onClick={() => setSelfieCaptured(false)}>
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
                    icon={<MapPin className="h-5 w-5" />}
                    accent="cyan"
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
                    icon={<Wallet className="h-5 w-5" />}
                    accent="emerald"
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
                    icon={<ClipboardCheck className="h-5 w-5" />}
                    accent="blue"
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
                          ok={selfieCaptured}
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
                      <p className="rounded-2xl border border-border/60 bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
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
          </div>
        </div>
      )}
    </div>
  );
}

// --- Sub-components ----------------------------------------------------------

type Accent = "violet" | "cyan" | "emerald" | "blue";

const ACCENT_CHIP: Record<Accent, string> = {
  violet: "from-brand-violet/30 to-brand-violet/5 text-brand-violet",
  cyan: "from-brand-cyan/30 to-brand-cyan/5 text-brand-cyan",
  emerald: "from-brand-emerald/30 to-brand-emerald/5 text-brand-emerald",
  blue: "from-brand-blue/30 to-brand-blue/5 text-brand-blue",
};

function StepShell({
  icon,
  accent,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  accent: Accent;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <span
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br ring-1 ring-white/10 ${ACCENT_CHIP[accent]}`}
        >
          {icon}
        </span>
        <div>
          <h3 className="font-display text-base font-semibold tracking-tight">{title}</h3>
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
      className={`rounded-2xl border p-4 transition-colors ${
        fileName ? "border-success/40 bg-success/[0.06]" : "border-dashed border-border/60 hover:border-primary/40"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 text-sm font-medium">
          <span
            className={`grid h-8 w-8 place-items-center rounded-lg ring-1 ${
              fileName
                ? "bg-success/15 text-success ring-success/25"
                : "bg-muted text-muted-foreground ring-white/5"
            }`}
          >
            <FileText className="h-4 w-4" />
          </span>
          {label}
        </span>
        {fileName && <CheckCircle2 className="h-4 w-4 text-success" />}
      </div>
      {fileName ? (
        <div className="mt-3 space-y-2">
          <p className="truncate font-mono text-xs text-muted-foreground" title={fileName}>
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
    <div
      className={`flex items-center justify-between gap-4 rounded-2xl border p-4 transition-colors ${
        checked ? "border-warning/30 bg-warning/[0.05]" : "border-border/60"
      }`}
    >
      <span className="text-sm">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </div>
  );
}

function ReviewGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/40 p-4">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      <dl className="space-y-1.5">{children}</dl>
    </div>
  );
}

function ReviewRow({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={`flex items-center gap-1.5 text-right font-medium ${
          ok === false ? "text-destructive" : ok ? "text-success" : ""
        }`}
      >
        {ok === true && <CheckCircle2 className="h-3.5 w-3.5" />}
        {ok === false && <XCircle className="h-3.5 w-3.5" />}
        {value}
      </dd>
    </div>
  );
}
