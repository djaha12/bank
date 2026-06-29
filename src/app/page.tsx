import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Sparkles,
  CreditCard,
  Globe2,
  ShieldCheck,
  Layers,
  Lock,
  LineChart,
  Zap,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ModeToggle } from "@/components/brand/mode-toggle";
import { VirtualCard } from "@/components/brand/virtual-card";
import { AnimatedNumber } from "@/components/brand/animated-number";
import { Reveal, HeroIntro } from "./LandingMotion";

const FEATURES = [
  {
    icon: Sparkles,
    title: "AI money assistant",
    body: "Ask about your spending, get a budget, spot unusual activity — grounded in your real ledger, swappable to any LLM.",
    accent: "from-brand-violet/25",
  },
  {
    icon: CreditCard,
    title: "Virtual cards",
    body: "Issue tokenized virtual cards in seconds. Freeze, set limits, merchant controls — no real PAN ever stored.",
    accent: "from-brand-cyan/25",
  },
  {
    icon: Globe2,
    title: "Multi-currency",
    body: "Hold KGS, USD and EUR. Convert at transparent rates with a real FX engine on a double-entry ledger.",
    accent: "from-brand-emerald/25",
  },
  {
    icon: ShieldCheck,
    title: "KYC / AML built-in",
    body: "Onboarding, sanctions screening sandbox, a rule-based risk engine and a full compliance backoffice.",
    accent: "from-brand-blue/25",
  },
  {
    icon: Layers,
    title: "Double-entry core",
    body: "Every movement posts balanced debit & credit entries. Append-only, idempotent, audited — banking done right.",
    accent: "from-brand-violet/25",
  },
  {
    icon: LineChart,
    title: "Analytics & budgets",
    body: "Spending by category, monthly cashflow, budgets, savings goals and anomaly detection out of the box.",
    accent: "from-brand-cyan/25",
  },
];

const SECURITY = [
  "Passkey-ready auth, device sessions & RBAC",
  "Idempotency keys on every money movement",
  "Tamper-evident, hash-chained audit log",
  "Rate limiting, Zod validation, secure headers",
  "PCI-minded: tokenized cards, no real PAN",
  "OWASP API Top 10 / ASVS / NIST aligned",
];

export default function LandingPage() {
  return (
    <div className="relative">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/60 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-gradient text-white shadow-glow">
              <Building2 className="h-5 w-5" />
            </span>
            <span className="font-display text-base font-semibold tracking-tight">
              NEO BANK <span className="text-muted-foreground">OS</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
            <a href="#features" className="transition-colors hover:text-foreground">Features</a>
            <a href="#security" className="transition-colors hover:text-foreground">Security</a>
            <a href="#ledger" className="transition-colors hover:text-foreground">Ledger</a>
          </nav>
          <div className="flex items-center gap-2">
            <ModeToggle />
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link href="/sign-in">Sign in</Link>
            </Button>
            <Button asChild variant="gradient" size="sm">
              <Link href="/sign-up">
                Get started <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="bg-grid absolute inset-0 -z-10" aria-hidden />
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:py-28">
          <HeroIntro className="flex flex-col justify-center">
            <Badge variant="outline" className="mb-5 w-fit gap-1.5 border-brand-violet/30 bg-brand-violet/10 text-foreground">
              <span className="dot text-brand-emerald" /> Sandbox · production-grade architecture
            </Badge>
            <h1 className="font-display text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
              The future of banking,
              <br />
              built for <span className="text-gradient">2026</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
              A complete virtual bank: multi-currency accounts, virtual cards, instant transfers,
              an AI money assistant and a compliance backoffice — all on a real double-entry ledger.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild variant="gradient" size="lg">
                <Link href="/sign-up">
                  Open a demo account <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/sign-in">Explore the dashboard</Link>
              </Button>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2"><Zap className="h-4 w-4 text-brand-cyan" /> Instant onboarding</span>
              <span className="inline-flex items-center gap-2"><Lock className="h-4 w-4 text-brand-violet" /> Bank-grade security</span>
              <span className="inline-flex items-center gap-2"><Layers className="h-4 w-4 text-brand-emerald" /> Double-entry ledger</span>
            </div>
          </HeroIntro>

          {/* Hero visual */}
          <div className="relative flex items-center justify-center">
            <div className="relative">
              <div className="absolute -inset-10 -z-10 rounded-full bg-brand-gradient opacity-20 blur-3xl" />
              <div className="animate-float">
                <VirtualCard
                  last4="2815"
                  holder="ALEX MORGAN"
                  expMonth={11}
                  expYear={2030}
                  currency="USD"
                  className="w-[22rem] max-w-full shadow-2xl"
                />
              </div>
              <Reveal delay={0.3} className="absolute -bottom-10 -left-8 hidden sm:block">
                <div className="glass-card w-56 p-4">
                  <div className="text-xs text-muted-foreground">Total balance</div>
                  <div className="font-display text-2xl font-semibold tracking-tight">с 245,284.80</div>
                  <div className="mt-1 text-xs text-success">▲ on the ledger</div>
                </div>
              </Reveal>
              <Reveal delay={0.45} className="absolute -right-6 -top-8 hidden sm:block">
                <div className="glass-card flex items-center gap-2 p-3">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-gradient text-white">
                    <Sparkles className="h-4 w-4" />
                  </span>
                  <div className="text-xs">
                    <div className="font-medium">AI insight</div>
                    <div className="text-muted-foreground">Groceries up 12%</div>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* Stats band */}
      <section id="ledger" className="border-y border-border/40 bg-card/30 backdrop-blur">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 py-12 sm:px-6 lg:grid-cols-4">
          {[
            { n: 3, suffix: "", label: "Currencies (KGS · USD · EUR)" },
            { n: 100, suffix: "%", label: "Balances from the ledger" },
            { n: 9, suffix: "", label: "AML / risk rules" },
            { n: 0, suffix: "", label: "Real PANs stored" },
          ].map((s, i) => (
            <Reveal key={i} delay={i * 0.08} className="text-center">
              <div className="font-display text-4xl font-semibold tracking-tight text-gradient">
                <AnimatedNumber value={s.n} suffix={s.suffix} />
              </div>
              <div className="mt-1 text-sm text-muted-foreground">{s.label}</div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Features bento */}
      <section id="features" className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Everything a modern bank needs
          </h2>
          <p className="mt-4 text-muted-foreground">
            Customer app, admin backoffice, core ledger, compliance, risk and AI — one coherent platform.
          </p>
        </Reveal>
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 0.06}>
              <div className="lift ring-glow group relative h-full overflow-hidden rounded-3xl border border-border/60 bg-card/60 p-6 backdrop-blur-xl">
                <div className={`absolute inset-0 -z-10 bg-gradient-to-br ${f.accent} to-transparent opacity-60`} />
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-gradient text-white shadow-glow">
                  <f.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-display text-lg font-semibold tracking-tight">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Security */}
      <section id="security" className="mx-auto max-w-7xl px-4 pb-24 sm:px-6">
        <div className="premium-surface ring-glow grid gap-10 overflow-hidden p-8 text-white sm:p-12 lg:grid-cols-2">
          <div className="flex flex-col justify-center">
            <Badge variant="outline" className="mb-4 w-fit border-white/20 bg-white/10 text-white">
              Security first
            </Badge>
            <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              Built like a real fintech, not a toy
            </h2>
            <p className="mt-4 max-w-md text-white/70">
              Security, then financial correctness, then UX, then AI. The foundation you can license and
              scale — not a pretty dashboard with fake balances.
            </p>
          </div>
          <ul className="grid gap-3 self-center">
            {SECURITY.map((s) => (
              <li key={s} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-emerald/30 text-brand-emerald">
                  <Check className="h-3.5 w-3.5" />
                </span>
                <span className="text-sm text-white/90">{s}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 pb-28 sm:px-6">
        <Reveal className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/60 p-10 text-center backdrop-blur-xl sm:p-16">
          <div className="bg-grid absolute inset-0 -z-10 opacity-50" aria-hidden />
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-5xl">
            Start banking in the <span className="text-gradient">future</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Spin up a demo account in seconds. Multi-currency wallets, a virtual card and an AI assistant
            are waiting — all simulated, all safe.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild variant="gradient" size="lg">
              <Link href="/sign-up">
                Create demo account <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/sign-in">Sign in</Link>
            </Button>
          </div>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-10 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-gradient text-white">
              <Building2 className="h-4 w-4" />
            </span>
            <span className="font-display font-semibold text-foreground">NEO BANK OS 2026</span>
          </div>
          <p className="max-w-md text-center sm:text-right">
            Sandbox prototype — not a real bank. All money is simulated on an internal ledger. No real
            cards, payments, deposits or KYC providers are connected.
          </p>
        </div>
      </footer>
    </div>
  );
}
