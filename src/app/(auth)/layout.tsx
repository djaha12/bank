import Link from "next/link";
import { Banknote, ShieldCheck, Sparkles, Layers, Lock } from "lucide-react";
import { ModeToggle } from "@/components/brand/mode-toggle";

/**
 * Minimal, centered auth layout. No app shell. A premium gradient aside on the
 * left (desktop) frames the form panel on the right. Sandbox throughout.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative grid min-h-screen lg:grid-cols-2">
      {/* ---- Brand aside (desktop) ---- */}
      <aside className="relative hidden overflow-hidden bg-brand-gradient lg:flex lg:flex-col lg:justify-between lg:p-12 text-white">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_30%_10%,rgba(255,255,255,0.18)_0%,transparent_60%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-white/10 blur-3xl"
          aria-hidden
        />

        <div className="relative">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/15 backdrop-blur">
              <Banknote className="h-5 w-5" />
            </span>
            <span className="text-base font-semibold tracking-tight">NEO BANK OS</span>
          </Link>
        </div>

        <div className="relative max-w-md">
          <h2 className="text-balance text-3xl font-bold leading-tight tracking-tight">
            The future of banking, built for 2026.
          </h2>
          <p className="mt-4 text-pretty text-sm leading-relaxed text-white/80">
            A secure, multi-currency sandbox where every transaction is backed by a real double-entry
            ledger. Play money, production-grade engineering.
          </p>

          <ul className="mt-8 space-y-4 text-sm">
            {[
              { icon: Sparkles, text: "AI that explains your money in plain language" },
              { icon: Layers, text: "Double-entry ledger — every cent balances to zero" },
              { icon: Lock, text: "Tokenised cards — no real PANs, IBANs or secrets" },
            ].map((row) => (
              <li key={row.text} className="flex items-center gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/15">
                  <row.icon className="h-4 w-4" />
                </span>
                <span className="text-white/90">{row.text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-center gap-2 text-xs text-white/70">
          <ShieldCheck className="h-4 w-4" />
          Sandbox environment — not a real bank. No real funds.
        </div>
      </aside>

      {/* ---- Form panel ---- */}
      <main className="relative flex min-h-screen flex-col bg-background">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-radial-glow lg:hidden" aria-hidden />

        <div className="flex items-center justify-between p-5">
          <Link href="/" className="inline-flex items-center gap-2.5 lg:invisible">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-gradient shadow-glow">
              <Banknote className="h-4 w-4 text-white" />
            </span>
            <span className="text-sm font-semibold tracking-tight">NEO BANK OS</span>
          </Link>
          <ModeToggle />
        </div>

        <div className="flex flex-1 items-center justify-center px-4 pb-12 sm:px-8">
          <div className="w-full max-w-md">{children}</div>
        </div>
      </main>
    </div>
  );
}
