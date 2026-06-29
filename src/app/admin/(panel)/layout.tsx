import { requirePageAdmin } from "@/lib/page-auth";
import { AppShell } from "@/components/app/app-shell";
import { ADMIN_NAV } from "@/components/app/nav-config";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requirePageAdmin();
  const name = [admin.firstName, admin.lastName].filter(Boolean).join(" ") || admin.email;
  return (
    <AppShell
      kind="admin"
      nav={ADMIN_NAV}
      logoutHref="/api/admin/logout"
      user={{ name, email: admin.email, firstName: admin.firstName, lastName: admin.lastName }}
    >
      {children}
    </AppShell>
  );
}
