import Link from "next/link";
import {
  Sparkles,
  CreditCard,
  Globe2,
  ShieldCheck,
  ArrowRight,
  Lock,
  ScrollText,
  Cpu,
  Layers,
  CheckCircle2,
  Banknote,
  Github,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ModeToggle } from "@/components/brand/mode-toggle";
import { VirtualCard } from "@/components/brand/virtual-card";
import { Currency } from "@prisma/client";
import { HeroIntro, FloatCard, Reveal, Stagger, StaggerItem } from "./LandingMotion";

/**
 * Public marketing landing page for NEO BANK OS 2026.
 * Server component; animated bits are delegated to ./LandingMotion (client).
 * This is a SANDBOX — no real money, accounts, or PII anywhere.
 */

const FEATURES = [
  {
    icon: Sparkles,
    title: "AI banking, built in",
    description:
      "An assistant that reads your double-entry ledger, explains spending, flags anomalies and drafts budgets — grounded in your real sandbox data, never guesses.",
    accent: "text-brand-violet",
    ring: "from-violet-500/20",
  },
  {
    icon: CreditCard,
    title: "Virtual cards in seconds",
    description:
      "Issue tokenised virtual debit cards, set per-transaction and daily limits, freeze instantly and control merchant categories. No real PANs — ever.",
    accent: "text-brand-blue",
    ring: "from-sky-500/20",
  },
  {
    icon: Globe2,
    title: "Global payments sandbox",
    description:
      "Multi-currency accounts in KGS, USD and EUR. Internal, P2P and bank-style transfers plus FX conversion with transparent, integer-precise spreads.",
    accent: "text-brand-emerald",
    ring: "from-emerald-500/20",
  },
  {
    icon: ShieldCheck,
    title: "Compliance-grade security",
    description:
      "KYC onboarding, AML monitoring, sanctions screening and a hash-chained, tamper-evident audit trail sit on top of a strict double-entry core ledger.",
    accent: "text-brand-blue",
    ring: "from-blue-500/20",
  },
] as const;

const TRUST = [
  { icon: Layers, label: "Double-entry ledger", value: "Every cent balances to zero" },
  { icon: Lock, label: "Tokenised cards", value: "No PANs, no IBANs, no secrets" },
  { icon: ScrollText, label: "Hash-chained audit", value: "Tamper-evident by design" },
  { icon: Cpu, label: "Idempotent money ops", value: "Exactly-once mutations" },
] as const;

const STEPS = [
  { n: "01", title: "Create your sandbox identity", body: "Sign up with email, verify a one-time code and trust your device." },
  { n: "02", title: "Pass KYC, get funded", body: "Complete mock identity verification and receive play funding instantly." },
  { n: "03", title: "Move money with confidence", body: "Transfer, convert, spend on virtual cards and watch the ledger reconcile." },
] as const;

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      {/* Ambient glow backdrop */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-radial-glow" aria-hidden />
      <div
        className="pointer-events-none absolute left-1/2 top-[-10rem] -z-10 h-[36rem] w-[60rem] -translate-x-1/2 rounded-full bg-brand-gradient opacity-[0.12] blur-3xl"
        aria-hidden
      />

      {/* ---- Sticky transparent navbar ---- */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/60 backdrop-blur-xl">
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-gradient shadow-glow">
              <Banknote className="h-5 w-5 text-white" />
            </span>
            <span className="text-base font-semibold tracking-tight">
              NEO BANK <span className="text-muted-foreground">OS</span>
            </span>
          </Link>

          <div className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
            <a href="#features" className="transition-colors hover:text-foreground">Features</a>
            <a href="#security" className="transition-colors hover:text-foreground">Security</a>
            <a href="#get-started" className="transition-colors hover:text-foreground">How it works</a>
          </div>

          <div className="flex items-center gap-2">
            <ModeToggle />
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link href="/sign-in">Sign in</Link>
            </Button>
            <Button asChild variant="gradient" size="sm">
              <Link href="/sign-up">
                Get started
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </nav>
      </header>

      {/* ---- Hero ---- */}
      <section className="relative mx-auto max-w-7xl px-4 pb-20 pt-16 sm:px-6 lg:px-8 lg:pt-24">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-8">
          <HeroIntro>
            <Badge variant="outline" className="mb-6 gap-1.5 border-border/70 px-3 py-1 text-xs">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-emerald opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-emerald" />
              </span>
              Virtual banking sandbox — live for 2026
            </Badge>

            <h1 className="text-balance text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              The future of banking,{" "}
              <span className="bg-brand-gradient bg-clip-text text-transparent">built for 2026</span>
            </h1>

            <p className="mt-6 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
              A secure, multi-currency banking sandbox: open accounts in KGS, USD and EUR, issue
              virtual cards, move money and let AI explain it all — every transaction backed by a real
              double-entry ledger. Play money, production-grade engineering.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild variant="gradient" size="lg">
                <Link href="/sign-up">
                  Open your sandbox
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/sign-in">I already have an account</Link>
              </Button>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-brand-emerald" /> No real money
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-brand-emerald" /> Instant KYC demo
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-brand-emerald" /> Free forever
              </span>
            </div>
          </HeroIntro>

          {/* Floating card mockup */}
          <div className="relative flex justify-center lg:justify-end">
            <div
              className="pointer-events-none absolute inset-0 -z-10 mx-auto h-72 w-72 rounded-full bg-brand-gradient opacity-25 blur-3xl"
              aria-hidden
            />
            <FloatCard className="w-full max-w-sm">
              <VirtualCard
                last4="4242"
                holder="ALEX MORGAN"
                expMonth={11}
                expYear={2030}
                currency={Currency.USD}
              />
              <div className="mt-5 grid grid-cols-3 gap-3">
                {[
                  { k: "Balance", v: "$12,840.00" },
                  { k: "Currencies", v: "KGS · USD · EUR" },
                  { k: "Cards", v: "Unlimited" },
                ].map((s) => (
                  <div key={s.k} className="glass-card p-3 text-center">
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{s.k}</div>
                    <div className="mt-0.5 text-xs font-semibold tabular-nums">{s.v}</div>
                  </div>
                ))}
              </div>
            </FloatCard>
          </div>
        </div>
      </section>

      {/* ---- Trust strip ---- */}
      <section id="security" className="border-y border-border/40 bg-card/30">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <p className="mb-5 text-center text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Built on a real double-entry ledger
          </p>
          <Stagger className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {TRUST.map((t) => (
              <StaggerItem key={t.label}>
                <div className="glass-card flex items-center gap-3 p-4">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <t.icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{t.label}</div>
                    <div className="truncate text-xs text-muted-foreground">{t.value}</div>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* ---- Features ---- */}
      <section id="features" className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <Badge variant="secondary" className="mb-4">Everything in one OS</Badge>
          <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            A complete bank, reimagined as software
          </h2>
          <p className="mt-4 text-pretty text-muted-foreground">
            From the ledger up: accounts, cards, payments, FX, AI and compliance — modular, typed and
            auditable. Explore every flow without risking a cent.
          </p>
        </Reveal>

        <Stagger className="mt-14 grid gap-6 md:grid-cols-2">
          {FEATURES.map((f) => (
            <StaggerItem key={f.title}>
              <div className="group relative h-full overflow-hidden rounded-2xl border border-border/70 bg-card p-7 shadow-card transition-all hover:border-border hover:shadow-glow dark:shadow-card-dark">
                <div
                  className={`pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-gradient-to-br ${f.ring} to-transparent opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100`}
                  aria-hidden
                />
                <span className="relative grid h-12 w-12 place-items-center rounded-xl border border-border/70 bg-background/60">
                  <f.icon className={`h-6 w-6 ${f.accent}`} />
                </span>
                <h3 className="relative mt-5 text-lg font-semibold tracking-tight">{f.title}</h3>
                <p className="relative mt-2 text-sm leading-relaxed text-muted-foreground">{f.description}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* ---- How it works ---- */}
      <section id="get-started" className="border-y border-border/40 bg-card/30">
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
          <Reveal className="mx-auto max-w-2xl text-center">
            <Badge variant="secondary" className="mb-4">Three steps</Badge>
            <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
              From sign-up to spending in minutes
            </h2>
          </Reveal>

          <Stagger className="mt-14 grid gap-6 md:grid-cols-3">
            {STEPS.map((s) => (
              <StaggerItem key={s.n}>
                <div className="relative h-full rounded-2xl border border-border/70 bg-card p-7 shadow-card dark:shadow-card-dark">
                  <span className="bg-brand-gradient bg-clip-text font-mono text-4xl font-bold text-transparent">
                    {s.n}
                  </span>
                  <h3 className="mt-3 text-lg font-semibold tracking-tight">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* ---- Final CTA ---- */}
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <Reveal>
          <div className="premium-surface relative overflow-hidden px-6 py-16 text-center sm:px-12">
            <div className="pointer-events-none absolute inset-0 bg-radial-glow" aria-hidden />
            <div className="relative mx-auto max-w-2xl">
              <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
                Ready to bank like it&apos;s 2026?
              </h2>
              <p className="mt-4 text-pretty text-muted-foreground">
                Spin up your virtual bank in under a minute. No card details, no commitment — just a
                pristine sandbox to explore the entire NEO BANK OS.
              </p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <Button asChild variant="gradient" size="lg">
                  <Link href="/sign-up">
                    Get started free
                    <ArrowRight className="h-5 w-5" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/sign-in">Sign in</Link>
                </Button>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ---- Sandbox disclaimer banner ---- */}
      <section className="mx-auto max-w-7xl px-4 pb-10 sm:px-6 lg:px-8">
        <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <p className="text-foreground/90">
            <span className="font-semibold">Sandbox notice.</span>{" "}
            NEO BANK OS 2026 is a demonstration environment. It is{" "}
            <span className="font-semibold">not a real bank</span>, holds no real funds, issues no real
            cards or account numbers, and is not a licensed financial institution. All money is play
            money on an internal ledger; do not enter real personal or financial information.
          </p>
        </div>
      </section>

      {/* ---- Footer ---- */}
      <footer className="border-t border-border/40 bg-card/30">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
            <div className="max-w-sm">
              <Link href="/" className="flex items-center gap-2.5">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-gradient shadow-glow">
                  <Banknote className="h-5 w-5 text-white" />
                </span>
                <span className="text-base font-semibold tracking-tight">NEO BANK OS</span>
              </Link>
              <p className="mt-4 text-sm text-muted-foreground">
                A production-grade virtual banking sandbox. Multi-currency accounts, virtual cards, AI
                insights and a double-entry core — all play money.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Product</div>
                <ul className="mt-3 space-y-2 text-sm">
                  <li><a href="#features" className="text-muted-foreground transition-colors hover:text-foreground">Features</a></li>
                  <li><a href="#security" className="text-muted-foreground transition-colors hover:text-foreground">Security</a></li>
                  <li><a href="#get-started" className="text-muted-foreground transition-colors hover:text-foreground">How it works</a></li>
                </ul>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Account</div>
                <ul className="mt-3 space-y-2 text-sm">
                  <li><Link href="/sign-in" className="text-muted-foreground transition-colors hover:text-foreground">Sign in</Link></li>
                  <li><Link href="/sign-up" className="text-muted-foreground transition-colors hover:text-foreground">Get started</Link></li>
                  <li><Link href="/admin/login" className="text-muted-foreground transition-colors hover:text-foreground">Admin console</Link></li>
                </ul>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">More</div>
                <ul className="mt-3 space-y-2 text-sm">
                  <li>
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <Github className="h-3.5 w-3.5" /> Open sandbox
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-2 border-t border-border/40 pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <p>© 2026 NEO BANK OS — sandbox demonstration. Not a real bank.</p>
            <p>No real money, PANs, IBANs or secrets are ever stored.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
