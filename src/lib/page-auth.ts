import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getAdmin } from "@/lib/rbac";

/** Server-component guard for the customer app. Redirects when unauthenticated. */
export async function requirePageUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  return user;
}

/** Server-component guard for the backoffice. Redirects to the admin login. */
export async function requirePageAdmin() {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}
