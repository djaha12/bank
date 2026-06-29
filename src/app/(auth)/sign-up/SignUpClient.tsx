"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Mail,
  Lock,
  User,
  Loader2,
  ArrowRight,
  ArrowLeft,
  KeyRound,
  AlertCircle,
  Check,
  ShieldCheck,
  Smartphone,
  MonitorSmartphone,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const STEP_LABELS = ["Account", "Verify", "Device"] as const;

export function SignUpClient() {
  const router = useRouter();
  const [step, setStep] = React.useState(0); // 0..2

  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [code, setCode] = React.useState("");
  const [trustDevice, setTrustDevice] = React.useState(true);

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch<{ userId: string; devCode?: string }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ firstName, lastName, email, password }),
      });
      if (res.devCode) {
        toast.info(`Sandbox code: ${res.devCode}`, { description: "Auto-filled for the demo." });
        setCode(res.devCode);
      } else {
        toast.success("Verification code sent to your email");
      }
      setStep(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create your account");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      // SIGNUP verification also establishes the session server-side.
      await apiFetch("/api/auth/otp/verify", {
        method: "POST",
        body: JSON.stringify({ email, code, purpose: "SIGNUP" }),
      });
      toast.success("Email verified");
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid or expired code");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setError(null);
    setLoading(true);
    try {
      const res = await apiFetch<{ delivered: boolean; devCode?: string }>("/api/auth/otp/request", {
        method: "POST",
        body: JSON.stringify({ email, purpose: "SIGNUP" }),
      });
      if (res.devCode) {
        toast.info(`Sandbox code: ${res.devCode}`);
        setCode(res.devCode);
      } else {
        toast.success("New code sent");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resend the code");
    } finally {
      setLoading(false);
    }
  }

  function handleFinish() {
    toast.success(trustDevice ? "Device trusted" : "Setup complete");
    router.push("/kyc");
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-6"
    >
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Create your sandbox</h1>
        <p className="text-sm text-muted-foreground">
          Open a NEO BANK OS account in three quick steps.
        </p>
      </div>

      {/* Stepper */}
      <div className="flex items-center">
        {STEP_LABELS.map((label, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <React.Fragment key={label}>
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={`grid h-8 w-8 place-items-center rounded-full border text-xs font-semibold transition-colors ${
                    done
                      ? "border-transparent bg-brand-gradient text-white"
                      : active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-muted/40 text-muted-foreground"
                  }`}
                >
                  {done ? <Check className="h-4 w-4" /> : i + 1}
                </div>
                <span className={`text-[11px] ${active ? "text-foreground" : "text-muted-foreground"}`}>
                  {label}
                </span>
              </div>
              {i < STEP_LABELS.length - 1 && (
                <div className="mx-2 mb-5 h-px flex-1 self-center">
                  <div className="h-full w-full bg-border">
                    <div
                      className={`h-full bg-brand-gradient transition-all duration-500 ${
                        i < step ? "w-full" : "w-0"
                      }`}
                    />
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <AnimatePresence mode="wait">
        {/* ---- Step 1: account ---- */}
        {step === 0 && (
          <motion.form
            key="step-account"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.3 }}
            onSubmit={handleRegister}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="firstName">First name</Label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="firstName"
                    autoComplete="given-name"
                    placeholder="Alex"
                    className="pl-9"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last name</Label>
                <Input
                  id="lastName"
                  autoComplete="family-name"
                  placeholder="Morgan"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="pl-9"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  className="pl-9"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  required
                />
              </div>
            </div>

            <Button type="submit" variant="gradient" size="lg" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {loading ? "Creating…" : "Continue"}
            </Button>
          </motion.form>
        )}

        {/* ---- Step 2: verify ---- */}
        {step === 1 && (
          <motion.form
            key="step-verify"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.3 }}
            onSubmit={handleVerify}
            className="space-y-4"
          >
            <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground">
              We sent a 6-digit code to{" "}
              <span className="font-medium text-foreground">{email || "your email"}</span>.
            </div>

            <div className="space-y-2">
              <Label htmlFor="code">Verification code</Label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="123456"
                  className="pl-9 font-mono tracking-[0.4em]"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  required
                />
              </div>
            </div>

            <Button type="submit" variant="gradient" size="lg" className="w-full" disabled={loading || code.length < 6}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {loading ? "Verifying…" : "Verify email"}
            </Button>

            <div className="flex items-center justify-between">
              <Button type="button" variant="ghost" size="sm" disabled={loading} onClick={() => setStep(0)}>
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button type="button" variant="link" size="sm" disabled={loading} onClick={handleResend}>
                Resend code
              </Button>
            </div>
          </motion.form>
        )}

        {/* ---- Step 3: device trust ---- */}
        {step === 2 && (
          <motion.div
            key="step-device"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.3 }}
            className="space-y-5"
          >
            <div className="flex flex-col items-center gap-3 rounded-xl border border-success/30 bg-success/5 px-6 py-8 text-center">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-success/15 text-success">
                <ShieldCheck className="h-6 w-6" />
              </span>
              <div>
                <h3 className="text-sm font-semibold">Email verified</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  One last step — decide whether to trust this device.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setTrustDevice((v) => !v)}
              className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-colors ${
                trustDevice ? "border-primary bg-primary/5" : "border-border/70 bg-card hover:bg-accent/50"
              }`}
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <MonitorSmartphone className="h-5 w-5" />
              </span>
              <span className="flex-1">
                <span className="block text-sm font-medium">Trust this device</span>
                <span className="block text-xs text-muted-foreground">
                  Skip extra verification on this device next time. You can revoke it anytime.
                </span>
              </span>
              <span
                className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors ${
                  trustDevice ? "border-transparent bg-primary text-primary-foreground" : "border-border"
                }`}
              >
                {trustDevice && <Check className="h-3.5 w-3.5" />}
              </span>
            </button>

            <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
              <Smartphone className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Sandbox device trust is for demonstration only — no real device fingerprinting is
                performed and no real data leaves this environment.
              </span>
            </div>

            <Button type="button" variant="gradient" size="lg" className="w-full" onClick={handleFinish}>
              Continue to verification
              <ArrowRight className="h-4 w-4" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {step === 0 && (
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/sign-in" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      )}

      <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-emerald" />
        <span>Sandbox environment — please do not enter real personal or financial information.</span>
      </div>
    </motion.div>
  );
}
