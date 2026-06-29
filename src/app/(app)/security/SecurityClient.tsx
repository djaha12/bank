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

function scoreTone(score: number): { label: string; ring: string; text: string; badge: "success" | "warning" | "destructive" } {
  if (score >= 80) return { label: "Strong", ring: "stroke-success", text: "text-success", badge: "success" };
  if (score >= 55) return { label: "Good", ring: "stroke-primary", text: "text-primary", badge: "warning" };
  return { label: "Needs attention", ring: "stroke-destructive", text: "text-destructive", badge: "destructive" };
}

// --- Score ring -------------------------------------------------------------

function ScoreRing({ score }: { score: number }) {
  const tone = scoreTone(score);
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);
  return (
    <div className="relative flex h-36 w-36 items-center justify-center">
      <svg className="h-36 w-36 -rotate-90" viewBox="0 0 128 128">
        <circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          strokeWidth="10"
          className="stroke-muted"
        />
        <motion.circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          className={tone.ring}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={`text-3xl font-bold tabular-nums ${tone.text}`}>{score}</span>
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">/ 100</span>
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
          <Card className="premium-surface h-full border-white/10 text-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <ShieldCheck className="h-5 w-5" /> Security score
              </CardTitle>
              <CardDescription className="text-white/70">
                A live estimate of your account&apos;s protection.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-3">
              <ScoreRing score={score} />
              <Badge variant={tone.badge}>{tone.label}</Badge>
              <p className="text-center text-xs text-white/60">
                {score >= 80
                  ? "Excellent. Keep trusted devices tidy and you're set."
                  : "Add a passkey and enable two-factor to strengthen your account."}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <div className="grid gap-6 sm:grid-cols-2 lg:col-span-2">
          <PostureCard
            icon={<KeyRound className="h-5 w-5 text-primary" />}
            title="Passkeys"
            value={String(passkeyCount)}
            hint={passkeyCount > 0 ? "Phishing-resistant sign-in" : "Not set up yet"}
            status={passkeyCount > 0 ? "good" : "warn"}
          />
          <PostureCard
            icon={<Smartphone className="h-5 w-5 text-primary" />}
            title="Active devices"
            value={String(deviceList.length)}
            hint={`${trustedDevices.length} trusted`}
            status={deviceList.length <= 3 ? "good" : "warn"}
          />
          <PostureCard
            icon={<XCircle className="h-5 w-5 text-destructive" />}
            title="Failed sign-ins"
            value={String(failedLogins)}
            hint="In your recent history"
            status={failedLogins === 0 ? "good" : "warn"}
          />
          <PostureCard
            icon={<ShieldAlert className="h-5 w-5 text-warning" />}
            title="Suspicious events"
            value={String(suspiciousLogins)}
            hint="Flagged by our risk engine"
            status={suspiciousLogins === 0 ? "good" : "bad"}
          />
        </div>
      </div>

      {/* Sign-in protection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-muted-foreground" /> Sign-in protection
          </CardTitle>
          <CardDescription>Extra layers that keep intruders out, even with your password.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-4 rounded-xl border border-border/60 p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-muted p-2">
                <Smartphone className="h-4 w-4 text-muted-foreground" />
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

          <div className="flex items-center justify-between gap-4 rounded-xl border border-dashed border-border/60 p-4 opacity-90">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-muted p-2">
                <Fingerprint className="h-4 w-4 text-muted-foreground" />
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
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <BadgeCheck className="h-5 w-5 text-success" /> Trusted devices
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
                      className="flex items-center justify-between gap-3 rounded-xl border border-success/30 bg-success/5 p-3"
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="h-4 w-4 text-success" />
                        <div>
                          <div className="text-sm font-medium">{d.deviceName}</div>
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

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Active sessions</CardTitle>
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
                      className="flex flex-col gap-3 rounded-xl border border-border/60 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-muted p-2">
                          <Icon className="h-4 w-4 text-muted-foreground" />
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
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent sign-in activity</CardTitle>
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
                      <TableRow key={e.id} className={e.suspicious ? "bg-warning/5" : undefined}>
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

function PostureCard({
  icon,
  title,
  value,
  hint,
  status,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  hint: string;
  status: "good" | "warn" | "bad";
}) {
  const ring =
    status === "good"
      ? "border-success/30"
      : status === "bad"
        ? "border-destructive/30"
        : "border-border/60";
  return (
    <Card className={`p-5 ${ring}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{title}</span>
        <span className="rounded-lg bg-muted p-1.5">{icon}</span>
      </div>
      <div className="mt-3 text-2xl font-semibold tabular-nums">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
    </Card>
  );
}
