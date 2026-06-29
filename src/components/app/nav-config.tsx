import {
  LayoutDashboard,
  Wallet,
  CreditCard,
  ArrowLeftRight,
  PieChart,
  PiggyBank,
  Sparkles,
  ShieldCheck,
  UserRound,
  Users,
  FileCheck2,
  ReceiptText,
  Siren,
  GaugeCircle,
  Gavel,
  ScrollText,
  KeyRound,
  Settings,
  Building2,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const CUSTOMER_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/accounts", label: "Accounts", icon: Wallet },
  { href: "/cards", label: "Cards", icon: CreditCard },
  { href: "/transfers", label: "Transfers", icon: ArrowLeftRight },
  { href: "/analytics", label: "Analytics", icon: PieChart },
  { href: "/savings", label: "Savings", icon: PiggyBank },
  { href: "/assistant", label: "AI Assistant", icon: Sparkles },
  { href: "/security", label: "Security", icon: ShieldCheck },
  { href: "/profile", label: "Profile", icon: UserRound },
];

export const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/kyc", label: "KYC Review", icon: FileCheck2 },
  { href: "/admin/transactions", label: "Transactions", icon: ReceiptText },
  { href: "/admin/aml", label: "AML Alerts", icon: Siren },
  { href: "/admin/risk", label: "Risk Engine", icon: GaugeCircle },
  { href: "/admin/cards", label: "Card Ops", icon: CreditCard },
  { href: "/admin/disputes", label: "Disputes", icon: Gavel },
  { href: "/admin/audit", label: "Audit Logs", icon: ScrollText },
  { href: "/admin/roles", label: "Roles", icon: KeyRound },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export const BRAND_ICON = Building2;
