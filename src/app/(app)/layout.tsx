import { requirePageUser } from "@/lib/page-auth";
import { AppShell } from "@/components/app/app-shell";
import { CUSTOMER_NAV } from "@/components/app/nav-config";

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
  return (
    <AppShell
      kind="customer"
      nav={CUSTOMER_NAV}
      logoutHref="/api/auth/logout"
      user={{ name, email: user.email, firstName: user.firstName, lastName: user.lastName }}
    >
      {children}
    </AppShell>
  );
}
