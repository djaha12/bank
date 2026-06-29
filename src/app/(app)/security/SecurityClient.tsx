"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Smartphone,
  Monitor,
  Laptop,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Fingerprint,
  LogOut,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lock,
  History,
  BadgeCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/brand/states";
import { StatCard } from "@/components/brand/stat-card";
import { AnimatedNumber } from "@/components/brand/animated-number";

// --- View models (all serialized; dates are ISO strings) --------------------

export interface DeviceVM {
  id: string;
  deviceName: string;
  userAgent: string | null;
  ip: string | null;
  trusted: boolean;
  current: boolean;
  lastSeen: string;
  createdAt: string;
}

export interface LoginEventVM {
  id: string;
  success: boolean;
  suspicious: boolean;
  reason: string | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function deviceIcon(ua: string | null) {
  const s = (ua ?? "").toLowerCase();
  if (/iphone|android|mobile/.test(s)) return Smartphone;
  if (/macintosh|mac os|windows nt.*(laptop)|macbook/.test(s)) return Laptop;
  return Monitor;
}

function scoreTone(score: number): { label: string; badge: "success" | "warning" | "destructive" } {
  if (score >= 80) return { label: "Strong", badge: "success" };
  if (score >= 55) return { label: "Good", badge: "warning" };
  return { label: "Needs attention", badge: "destructive" };
}

// --- Score ring -------------------------------------------------------------

function ScoreRing({ score }: { score: number }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);
  return (
    <div className="relative flex h-40 w-40 items-center justify-center">
      {/* soft glow halo behind the ring */}
      <div className="absolute h-28 w-28 rounded-full bg-brand-gradient opacity-25 blur-2xl" />
      <svg className="h-40 w-40 -rotate-90" viewBox="0 0 128 128">
        <defs>
          <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(var(--brand-violet))" />
            <stop offset="55%" stopColor="hsl(var(--brand-blue))" />
            <stop offset="100%" stopColor="hsl(var(--brand-cyan))" />
          </linearGradient>
        </defs>
        <circle cx="64" cy="64" r={radius} fill="none" strokeWidth="10" className="stroke-white/10" />
        <motion.circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          stroke="url(#scoreGradient)"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <AnimatedNumber
          value={score}
          className="font-display text-4xl font-semibold leading-none tracking-tight text-white"
        />
        <span className="mt-1 text-[11px] uppercase tracking-wide text-white/60">/ 100</span>
      </div>
    </div>
  );
}

// --- Main client ------------------------------------------------------------

export function SecurityClient({
  score,
  devices,
  loginEvents,
  passkeyCount,
  suspiciousLogins,
  failedLogins,
}: {
  score: number;
  devices: DeviceVM[];
  loginEvents: LoginEventVM[];
  passkeyCount: number;
  suspiciousLogins: number;
  failedLogins: number;
}) {
  const [deviceList, setDeviceList] = React.useState<DeviceVM[]>(devices);
  const [twoFactor, setTwoFactor] = React.useState(false);
  const [revoking, setRevoking] = React.useState<string | null>(null);
  const tone = scoreTone(score);

  const trustedDevices = deviceList.filter((d) => d.trusted);

  // Revoke is a sandbox-optimistic action — remove the device locally and toast.
  async function revoke(device: DeviceVM) {
    if (device.current) {
      toast.error("You can't revoke the device you're currently using");
      return;
    }
    setRevoking(device.id);
    // Optimistic: drop it from the list immediately.
    setDeviceList((prev) => prev.filter((d) => d.id !== device.id));
    // Simulated round-trip (no destructive shared route in this assignment).
    await new Promise((r) => setTimeout(r, 450));
    setRevoking(null);
    toast.success("Device signed out", {
      description: `${device.deviceName} no longer has access`,
    });
  }

  function toggleTrust(device: DeviceVM, value: boolean) {
    setDeviceList((prev) =>
      prev.map((d) => (d.id === device.id ? { ...d, trusted: value } : d)),
    );
    toast.success(value ? "Device marked as trusted" : "Trust removed", {
      description: device.deviceName,
    });
  }

  function toggle2fa(value: boolean) {
    setTwoFactor(value);
    toast.success(value ? "Two-factor authentication enabled" : "Two-factor authentication disabled", {
      description: value
        ? "You'll be asked for a one-time code at sign-in (sandbox mock)."
        : "Your account now relies on password only.",
    });
  }

  return (
    <div className="space-y-6">
      {/* Top row — score + posture stats */}
      <div className="grid gap-6 lg:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 120, damping: 18 }}
          className="lg:col-span-1"
        >
          <Card className="premium-surface ring-glow lift h-full border-white/10 text-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-white">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-white/10 ring-1 ring-white/15">
                  <ShieldCheck className="h-4 w-4" />
                </span>
                Security score
              </CardTitle>
              <CardDescription className="text-white/70">
                A live estimate of your account&apos;s protection.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-3">
              <ScoreRing score={score} />
              <Badge
                variant={tone.badge}
                className="border border-white/20 bg-white/10 text-white backdrop-blur"
              >
                {tone.label}
              </Badge>
              <p className="text-center text-xs text-white/60">
                {score >= 80
                  ? "Excellent. Keep trusted devices tidy and you're set."
                  : "Add a passkey and enable two-factor to strengthen your account."}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2">
          <StatCard
            label="Passkeys"
            accent="violet"
            index={0}
            value={<AnimatedNumber value={passkeyCount} />}
            hint={passkeyCount > 0 ? "Phishing-resistant sign-in" : "Not set up yet"}
            icon={<KeyRound className="h-4 w-4" />}
          />
          <StatCard
            label="Active devices"
            accent="blue"
            index={1}
            value={<AnimatedNumber value={deviceList.length} />}
            hint={`${trustedDevices.length} trusted`}
            icon={<Smartphone className="h-4 w-4" />}
          />
          <StatCard
            label="Failed sign-ins"
            accent={failedLogins === 0 ? "emerald" : "violet"}
            index={2}
            value={<AnimatedNumber value={failedLogins} />}
            hint="In your recent history"
            icon={<XCircle className="h-4 w-4" />}
          />
          <StatCard
            label="Suspicious events"
            accent={suspiciousLogins === 0 ? "emerald" : "violet"}
            index={3}
            value={<AnimatedNumber value={suspiciousLogins} />}
            hint="Flagged by our risk engine"
            icon={<ShieldAlert className="h-4 w-4" />}
          />
        </div>
      </div>

      {/* Sign-in protection */}
      <Card className="ring-glow lift">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-brand-blue/30 to-brand-blue/5 text-brand-blue ring-1 ring-white/10">
              <Lock className="h-4 w-4" />
            </span>
            Sign-in protection
          </CardTitle>
          <CardDescription>Extra layers that keep intruders out, even with your password.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-border/60 bg-card/50 p-4 transition-colors hover:border-brand-violet/30">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand-violet/25 to-brand-violet/5 text-brand-violet ring-1 ring-white/10">
                <Smartphone className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2 text-sm font-medium">
                  Two-factor authentication
                  {twoFactor && <Badge variant="success">On</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">
                  Require a one-time code at sign-in. Sandbox mock — no SMS is actually sent.
                </p>
              </div>
            </div>
            <Switch checked={twoFactor} onCheckedChange={toggle2fa} aria-label="Two-factor authentication" />
          </div>

          <div className="flex items-center justify-between gap-4 rounded-2xl border border-dashed border-border/60 bg-card/30 p-4">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand-cyan/25 to-brand-cyan/5 text-brand-cyan ring-1 ring-white/10">
                <Fingerprint className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2 text-sm font-medium">
                  Add a passkey
                  <Badge variant="secondary">Coming soon</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Sign in with Face ID, Touch ID or a security key — no password needed.
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" disabled>
              <Fingerprint className="h-4 w-4" /> Add a passkey
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Devices + history tabs */}
      <Tabs defaultValue="devices">
        <TabsList>
          <TabsTrigger value="devices">
            <Smartphone className="mr-2 h-4 w-4" /> Devices &amp; sessions
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="mr-2 h-4 w-4" /> Login history
          </TabsTrigger>
        </TabsList>

        <TabsContent value="devices" className="space-y-6">
          {/* Trusted devices spotlight */}
          {trustedDevices.length > 0 && (
            <Card className="ring-glow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-display text-base">
                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-brand-emerald/30 to-brand-emerald/5 text-brand-emerald ring-1 ring-white/10">
                    <BadgeCheck className="h-4 w-4" />
                  </span>
                  Trusted devices
                </CardTitle>
                <CardDescription>
                  These devices skip extra verification. Remove trust if one is lost or shared.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                {trustedDevices.map((d) => {
                  const Icon = deviceIcon(d.userAgent);
                  return (
                    <div
                      key={d.id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-success/30 bg-success/[0.06] p-3.5 transition-colors hover:bg-success/10"
                    >
                      <div className="flex items-center gap-3">
                        <span className="grid h-9 w-9 place-items-center rounded-xl bg-success/15 text-success ring-1 ring-success/20">
                          <Icon className="h-4 w-4" />
                        </span>
                        <div>
                          <div className="flex items-center gap-1.5 text-sm font-medium">
                            <span className="dot text-brand-emerald" />
                            {d.deviceName}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Last active {relativeTime(d.lastSeen)}
                          </div>
                        </div>
                      </div>
                      <Switch
                        checked={d.trusted}
                        onCheckedChange={(v) => toggleTrust(d, v)}
                        aria-label="Trusted"
                      />
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          <Card className="ring-glow">
            <CardHeader>
              <CardTitle className="font-display text-base">Active sessions</CardTitle>
              <CardDescription>Everywhere you&apos;re currently signed in.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {deviceList.length === 0 ? (
                <EmptyState
                  icon={<Smartphone className="h-6 w-6" />}
                  title="No active sessions"
                  description="Sign in on a device and it will appear here."
                />
              ) : (
                deviceList.map((d, i) => {
                  const Icon = deviceIcon(d.userAgent);
                  return (
                    <motion.div
                      key={d.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i * 0.04, 0.25) }}
                      className="group flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/40 p-4 transition-all hover:border-brand-violet/30 hover:bg-card/70 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-brand-blue/20 to-brand-blue/5 text-brand-blue ring-1 ring-white/10">
                          <Icon className="h-4 w-4" />
                          {d.current && (
                            <span className="dot absolute -right-0.5 -top-0.5 text-brand-emerald" />
                          )}
                        </div>
                        <div className="space-y-0.5">
                          <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                            {d.deviceName}
                            {d.current && <Badge variant="default">This device</Badge>}
                            {d.trusted && <Badge variant="success">Trusted</Badge>}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {d.ip ? `IP ${d.ip} · ` : ""}Last active {relativeTime(d.lastSeen)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 sm:justify-end">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Trusted</span>
                          <Switch
                            checked={d.trusted}
                            onCheckedChange={(v) => toggleTrust(d, v)}
                            aria-label="Trust device"
                            disabled={revoking === d.id}
                          />
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => revoke(d)}
                          disabled={d.current || revoking === d.id}
                        >
                          <LogOut className="h-4 w-4" />
                          {revoking === d.id ? "Revoking…" : "Revoke"}
                        </Button>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card className="ring-glow">
            <CardHeader>
              <CardTitle className="font-display text-base">Recent sign-in activity</CardTitle>
              <CardDescription>
                We keep a record of every attempt. Spot something you don&apos;t recognise? Change your password.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loginEvents.length === 0 ? (
                <EmptyState
                  icon={<History className="h-6 w-6" />}
                  title="No sign-in history yet"
                  description="Your login attempts will be recorded here."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Result</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead className="hidden sm:table-cell">IP</TableHead>
                      <TableHead className="text-right">When</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loginEvents.map((e) => (
                      <TableRow
                        key={e.id}
                        className={`transition-colors hover:bg-muted/40 ${e.suspicious ? "bg-warning/5" : ""}`}
                      >
                        <TableCell>
                          {e.success ? (
                            <span className="inline-flex items-center gap-1.5 text-sm text-success">
                              <CheckCircle2 className="h-4 w-4" /> Success
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-sm text-destructive">
                              <XCircle className="h-4 w-4" /> Failed
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm text-muted-foreground">
                              {e.reason ?? (e.success ? "Password sign-in" : "Invalid credentials")}
                            </span>
                            {e.suspicious && (
                              <Badge variant="warning">
                                <AlertTriangle className="mr-1 h-3 w-3" /> Suspicious
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden font-mono text-xs text-muted-foreground sm:table-cell">
                          {e.ip ?? "—"}
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground tabular-nums">
                          {relativeTime(e.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
