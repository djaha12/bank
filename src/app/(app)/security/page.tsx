import { ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/brand/page-header";
import { requirePageUser } from "@/lib/page-auth";
import { prisma } from "@/lib/db";
import { SecurityClient, type DeviceVM, type LoginEventVM } from "./SecurityClient";

export const dynamic = "force-dynamic";

/**
 * Security — server component. Loads the signed-in user's own device sessions,
 * recent login history and passkey count, then computes a "security score"
 * heuristic and hands serialized props to the interactive client. Every query
 * is scoped to user.id; nothing sensitive (raw tokens, IPs of others) leaks.
 */
export default async function SecurityPage() {
  const user = await requirePageUser();

  const [sessions, loginEvents, passkeyCount] = await Promise.all([
    prisma.deviceSession.findMany({
      where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastSeenAt: "desc" },
      take: 25,
    }),
    prisma.loginEvent.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.webAuthnCredential.count({ where: { userId: user.id } }),
  ]);

  // Mask an IP address — keep the network portion, hide the host.
  const maskIp = (ip: string | null): string | null => {
    if (!ip) return null;
    if (ip.includes(":")) {
      const head = ip.split(":").slice(0, 2).join(":");
      return `${head}:••••`;
    }
    const parts = ip.split(".");
    if (parts.length === 4) return `${parts[0]}.${parts[1]}.•.•`;
    return "•••";
  };

  const currentSessionId = user.sessionId;

  const deviceVMs: DeviceVM[] = sessions.map((s) => ({
    id: s.id,
    deviceName: s.deviceName ?? "Unknown device",
    userAgent: s.userAgent ?? null,
    ip: maskIp(s.ipAddress),
    trusted: s.trusted,
    current: s.id === currentSessionId,
    lastSeen: s.lastSeenAt.toISOString(),
    createdAt: s.createdAt.toISOString(),
  }));

  const loginVMs: LoginEventVM[] = loginEvents.map((e) => ({
    id: e.id,
    success: e.success,
    suspicious: e.suspicious,
    reason: e.reason ?? null,
    ip: maskIp(e.ipAddress),
    userAgent: e.userAgent ?? null,
    createdAt: e.createdAt.toISOString(),
  }));

  // Security score heuristic (0-100). All factors derived from the user's own data.
  const trustedCount = deviceVMs.filter((d) => d.trusted).length;
  const failedLogins = loginVMs.filter((e) => !e.success).length;
  const suspiciousLogins = loginVMs.filter((e) => e.suspicious).length;

  let score = 60;
  if (passkeyCount > 0) score += 15;
  if (trustedCount > 0) score += 10;
  if (deviceVMs.length <= 3) score += 10;
  score -= Math.min(20, failedLogins * 3);
  score -= Math.min(15, suspiciousLogins * 5);
  score = Math.max(5, Math.min(100, score));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Security"
        description="Protect your account. Review devices, sign-in activity and your security posture."
        actions={
          <div className="hidden items-center gap-2 rounded-full border border-border/60 bg-card/60 px-3 py-1.5 text-xs text-muted-foreground sm:flex">
            <ShieldCheck className="h-4 w-4 text-success" />
            Sandbox account — no real funds at risk
          </div>
        }
      />
      <SecurityClient
        score={score}
        devices={deviceVMs}
        loginEvents={loginVMs}
        passkeyCount={passkeyCount}
        suspiciousLogins={suspiciousLogins}
        failedLogins={failedLogins}
      />
    </div>
  );
}
