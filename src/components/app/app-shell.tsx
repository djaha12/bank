"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, LogOut } from "lucide-react";
import { NotificationsBell } from "@/components/app/notifications-bell";
import { CommandPalette } from "@/components/app/command-palette";
import { cn, initials as makeInitials } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ModeToggle } from "@/components/brand/mode-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ADMIN_NAV, BRAND_ICON, CUSTOMER_NAV } from "@/components/app/nav-config";

export function AppShell({
  user,
  kind,
  logoutHref,
  children,
}: {
  user: { name: string; email: string; firstName?: string | null; lastName?: string | null };
  kind: "customer" | "admin";
  logoutHref: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  // Nav (with lucide icon *components*) is resolved INSIDE this client
  // component — icon functions must never be passed across the server→client
  // boundary (they are not serializable).
  const nav = kind === "admin" ? ADMIN_NAV : CUSTOMER_NAV;

  const isActive = (href: string) =>
    href === "/dashboard" || href === "/admin" ? pathname === href : pathname.startsWith(href);

  async function logout() {
    await fetch(logoutHref, { method: "POST" }).catch(() => {});
    router.push(kind === "admin" ? "/admin/login" : "/sign-in");
    router.refresh();
  }

  const NavLinks = ({ onNavigate }: { onNavigate?: () => void }) => (
    <nav className="flex flex-col gap-1">
      {nav.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const Brand = (
    <Link href={kind === "admin" ? "/admin" : "/dashboard"} className="flex items-center gap-2 px-1">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-gradient text-white">
        <BRAND_ICON className="h-4 w-4" />
      </span>
      <span className="text-sm font-semibold tracking-tight">
        NEO BANK <span className="text-muted-foreground">{kind === "admin" ? "Admin" : "OS"}</span>
      </span>
    </Link>
  );

  return (
    <div className="min-h-screen bg-radial-glow">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border/60 bg-card/40 px-4 py-5 backdrop-blur-xl lg:flex">
        <div className="mb-6">{Brand}</div>
        <NavLinks />
        <div className="mt-auto rounded-lg border border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground">
          Sandbox environment — not a real bank. All money is simulated.
        </div>
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            />
            <motion.aside
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-card px-4 py-5 lg:hidden"
            >
              <div className="mb-6 flex items-center justify-between">
                {Brand}
                <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <NavLinks onNavigate={() => setMobileOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main column */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border/60 bg-background/70 px-4 backdrop-blur-xl sm:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <CommandPalette kind={kind} />
          <div className="ml-auto flex items-center gap-1.5">
            {kind === "customer" && <NotificationsBell />}
            <ModeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full p-0.5 pr-2 hover:bg-accent">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>{makeInitials(user.firstName, user.lastName)}</AvatarFallback>
                  </Avatar>
                  <span className="hidden text-sm font-medium sm:inline">{user.name}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="font-medium">{user.name}</div>
                  <div className="text-xs font-normal text-muted-foreground">{user.email}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {kind === "customer" && (
                  <DropdownMenuItem asChild>
                    <Link href="/profile">Profile &amp; settings</Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
                  <LogOut className="h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
