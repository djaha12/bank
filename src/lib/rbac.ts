import { prisma } from "@/lib/db";
import { Errors } from "@/lib/errors";
import { getAdminIdFromSession } from "@/lib/session";

/**
 * RBAC catalog. Permissions are fine-grained capability keys; roles bundle
 * them. Seeded into the DB (Role / Permission / RolePermission) so they can be
 * managed at runtime, but this object is the source of truth for the seed.
 */
export const PERMISSIONS = {
  CUSTOMERS_READ: "customers.read",
  CUSTOMERS_WRITE: "customers.write",
  KYC_READ: "kyc.read",
  KYC_REVIEW: "kyc.review",
  TRANSACTIONS_READ: "transactions.read",
  TRANSACTIONS_REVIEW: "transactions.review",
  AML_READ: "aml.read",
  AML_WRITE: "aml.write",
  RISK_READ: "risk.read",
  CARDS_READ: "cards.read",
  CARDS_WRITE: "cards.write",
  DISPUTES_READ: "disputes.read",
  DISPUTES_WRITE: "disputes.write",
  AUDIT_READ: "audit.read",
  ROLES_READ: "roles.read",
  ROLES_WRITE: "roles.write",
  SETTINGS_READ: "settings.read",
  SETTINGS_WRITE: "settings.write",
  COMPLIANCE_DASHBOARD: "compliance.dashboard",
  SYSTEM_HEALTH: "system.health",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const ALL = Object.values(PERMISSIONS);

export const ROLE_DEFINITIONS: Record<
  string,
  { name: string; description: string; permissions: PermissionKey[] }
> = {
  super_admin: {
    name: "Super Admin",
    description: "Full backoffice access",
    permissions: ALL,
  },
  compliance_officer: {
    name: "Compliance Officer",
    description: "KYC, AML, risk and audit oversight",
    permissions: [
      PERMISSIONS.CUSTOMERS_READ,
      PERMISSIONS.KYC_READ,
      PERMISSIONS.KYC_REVIEW,
      PERMISSIONS.TRANSACTIONS_READ,
      PERMISSIONS.TRANSACTIONS_REVIEW,
      PERMISSIONS.AML_READ,
      PERMISSIONS.AML_WRITE,
      PERMISSIONS.RISK_READ,
      PERMISSIONS.AUDIT_READ,
      PERMISSIONS.COMPLIANCE_DASHBOARD,
    ],
  },
  support_agent: {
    name: "Support Agent",
    description: "Customer support and disputes",
    permissions: [
      PERMISSIONS.CUSTOMERS_READ,
      PERMISSIONS.KYC_READ,
      PERMISSIONS.TRANSACTIONS_READ,
      PERMISSIONS.CARDS_READ,
      PERMISSIONS.DISPUTES_READ,
      PERMISSIONS.DISPUTES_WRITE,
    ],
  },
};

export interface AdminContext {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  permissions: Set<string>;
}

export async function getAdmin(): Promise<AdminContext | null> {
  const adminId = await getAdminIdFromSession();
  if (!adminId) return null;
  const admin = await prisma.adminUser.findUnique({
    where: { id: adminId },
    include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } },
  });
  if (!admin || !admin.active || admin.deletedAt) return null;

  const permissions = new Set<string>();
  const roles: string[] = [];
  for (const ar of admin.roles) {
    roles.push(ar.role.key);
    for (const rp of ar.role.permissions) permissions.add(rp.permission.key);
  }
  return {
    id: admin.id,
    email: admin.email,
    firstName: admin.firstName,
    lastName: admin.lastName,
    roles,
    permissions,
  };
}

export function adminHasPermission(admin: AdminContext, permission: PermissionKey): boolean {
  return admin.permissions.has(permission);
}

/** Require an authenticated admin, optionally with a specific permission. */
export async function requireAdmin(permission?: PermissionKey): Promise<AdminContext> {
  const admin = await getAdmin();
  if (!admin) throw Errors.unauthorized("Admin authentication required");
  if (permission && !adminHasPermission(admin, permission)) {
    throw Errors.forbidden(`Missing permission: ${permission}`);
  }
  return admin;
}
