import type { Metadata } from "next";
import Link from "next/link";
import { ShieldHalf, Lock, ScrollText } from "lucide-react";
import { ModeToggle } from "@/components/brand/mode-toggle";
import { AdminLoginClient } from "./AdminLoginClient";

export const metadata: Metadata = {
  title: "Admin console · NEO BANK OS 2026",
};

/**
 * Backoffice sign-in. Distinct from the customer auth pages: darker, denser,
 * "control room" framing. Standalone (no app shell, no customer auth layout).
 */
export default function AdminLoginPage() {
  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-background px-4 py-12">
      {/* Backoffice grid + glow backdrop */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.4] [background-image:linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border))_1px,transparent_1px)] [background-size:42px_42px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_40%,#000_30%,transparent_75%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute left-1/2 top-0 -z-10 h-64 w-[40rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
        aria-hidden
      />

      <div className="absolute right-4 top-4">
        <ModeToggle />
      </div>

      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="grid h-12 w-12 place-items-center rounded-xl border border-border bg-card shadow-card dark:shadow-card-dark">
            <ShieldHalf className="h-6 w-6 text-primary" />
          </span>
          <h1 className="mt-4 text-xl font-bold tracking-tight">Backoffice console</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Restricted access — staff authentication required.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card/80 p-6 shadow-card backdrop-blur-xl dark:shadow-card-dark sm:p-8">
          <AdminLoginClient />
        </div>

        <div className="mt-5 flex items-center justify-center gap-4 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5" /> All actions audited
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ScrollText className="h-3.5 w-3.5" /> Hash-chained log
          </span>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Not staff?{" "}
          <Link href="/sign-in" className="font-medium text-primary hover:underline">
            Customer sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
