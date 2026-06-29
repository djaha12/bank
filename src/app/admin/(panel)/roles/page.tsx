import * as React from "react";
import { KeyRound, Check, Minus, ShieldCheck } from "lucide-react";
import { requirePageAdmin } from "@/lib/page-auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/brand/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/brand/states";

export default async function AdminRolesPage() {
  await requirePageAdmin();

  const [roles, permissions] = await Promise.all([
    prisma.role.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        permissions: { include: { permission: { select: { key: true } } } },
        admins: { select: { adminUserId: true } },
      },
    }),
    prisma.permission.findMany({ orderBy: { key: "asc" } }),
  ]);

  // Map each role to the set of permission keys it grants.
  const roleGrants = new Map<string, Set<string>>();
  for (const r of roles) {
    roleGrants.set(r.id, new Set(r.permissions.map((rp) => rp.permission.key)));
  }

  // Group permissions by their domain prefix (e.g. "kyc", "aml").
  const groups = new Map<string, typeof permissions>();
  for (const p of permissions) {
    const domain = p.key.split(".")[0] ?? "other";
    const list = groups.get(domain) ?? [];
    list.push(p);
    groups.set(domain, list);
  }
  const groupEntries = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <>
            Roles &amp; <span className="text-gradient">permissions</span>
          </>
        }
        description="Role-based access control matrix. Read-only — roles and grants are seeded from the RBAC catalogue."
        actions={
          <span className="inline-flex items-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-3 py-1.5 text-sm font-medium text-muted-foreground backdrop-blur">
            <KeyRound className="h-4 w-4 text-brand-violet" />
            <span className="tabular-nums text-foreground">{roles.length}</span> roles ·{" "}
            <span className="tabular-nums text-foreground">{permissions.length}</span> permissions
          </span>
        }
      />

      {/* Role summary cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {roles.map((r) => (
          <Card key={r.id} className="glass-card ring-glow lift group relative overflow-hidden p-5">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <h3 className="font-display text-sm font-semibold tracking-tight">{r.name}</h3>
                <code className="text-xs text-muted-foreground">{r.key}</code>
              </div>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-violet/30 to-brand-violet/5 text-brand-violet ring-1 ring-white/10">
                <ShieldCheck className="h-4 w-4" />
              </span>
            </div>
            {r.description && (
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{r.description}</p>
            )}
            <div className="mt-3 flex items-center gap-2">
              <Badge variant="default">{roleGrants.get(r.id)?.size ?? 0} permissions</Badge>
              <Badge variant="secondary">{r.admins.length} admins</Badge>
            </div>
          </Card>
        ))}
      </div>

      {/* Permission matrix */}
      {permissions.length === 0 || roles.length === 0 ? (
        <Card>
          <CardContent className="py-4">
            <EmptyState
              title="No RBAC catalogue"
              description="No roles or permissions are seeded yet."
              icon={<KeyRound className="h-6 w-6" />}
            />
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Permission matrix</CardTitle>
            <CardDescription>
              Which capabilities each role grants, grouped by domain.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <div className="relative w-full overflow-auto scroll-thin">
              <table className="w-full caption-bottom text-sm">
                <thead>
                  <tr className="border-b border-border/60">
                    <th className="sticky left-0 z-10 bg-card px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Permission
                    </th>
                    {roles.map((r) => (
                      <th
                        key={r.id}
                        className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground"
                      >
                        {r.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {groupEntries.map(([domain, perms]) => (
                    <React.Fragment key={domain}>
                      <tr className="border-b border-border/60 bg-muted/30">
                        <td
                          colSpan={roles.length + 1}
                          className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                        >
                          {domain}
                        </td>
                      </tr>
                      {perms.map((p) => (
                        <tr
                          key={p.id}
                          className="border-b border-border/60 transition-colors hover:bg-muted/40"
                        >
                          <td className="sticky left-0 z-10 bg-card px-4 py-2.5">
                            <code className="text-xs">{p.key}</code>
                            {p.description && (
                              <span className="block text-[11px] text-muted-foreground">
                                {p.description}
                              </span>
                            )}
                          </td>
                          {roles.map((r) => {
                            const granted = roleGrants.get(r.id)?.has(p.key) ?? false;
                            return (
                              <td key={r.id} className="px-4 py-2.5 text-center">
                                {granted ? (
                                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-success/15 text-success">
                                    <Check className="h-3.5 w-3.5" />
                                  </span>
                                ) : (
                                  <span className="inline-flex h-6 w-6 items-center justify-center text-muted-foreground/40">
                                    <Minus className="h-3.5 w-3.5" />
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
