"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeftRight,
  Banknote,
  CalendarClock,
  CheckCircle2,
  QrCode,
  Send,
  ShieldAlert,
} from "lucide-react";
import { Currency } from "@prisma/client";
import { toast } from "sonner";
import { MoneyText } from "@/components/brand/money-text";
import { AnimatedMoney } from "@/components/brand/animated-number";
import { SuccessState } from "@/components/brand/states";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch, newIdempotencyKey } from "@/lib/client";

export interface TransferAccountVM {
  id: string;
  name: string;
  currency: Currency;
  displayNumber: string;
  balance: string;
  available: string;
}

type Kind = "OWN" | "P2P" | "BANK" | "QR" | "SCHEDULED";

interface TransferResultVM {
  transferId: string;
  transactionId: string;
  status: string;
  fromBalanceAfter: string;
  toBalanceAfter: string | null;
  fee: string;
  currency: Currency;
  alerts: number;
}

// Phase of each tab's flow.
type Phase = "form" | "confirm" | "receipt";

interface Draft {
  kind: Kind;
  fromAccountId: string;
  amount: string;
  note: string;
  // P2P / QR
  recipientEmail?: string;
  toAccountId?: string;
  // Bank
  counterpartyName?: string;
  bank?: string;
  country?: string;
  // Scheduled
  scheduledFor?: string;
}

const COUNTRIES = ["KG", "US", "GB", "DE", "FR", "TR", "AE", "KZ"];

function accountById(accounts: TransferAccountVM[], id: string): TransferAccountVM | undefined {
  return accounts.find((a) => a.id === id);
}

const TABS: { value: Kind; label: string; icon: React.ReactNode }[] = [
  { value: "OWN", label: "Own", icon: <ArrowLeftRight className="h-4 w-4" /> },
  { value: "P2P", label: "P2P", icon: <Send className="h-4 w-4" /> },
  { value: "BANK", label: "Bank", icon: <Banknote className="h-4 w-4" /> },
  { value: "QR", label: "QR", icon: <QrCode className="h-4 w-4" /> },
  { value: "SCHEDULED", label: "Scheduled", icon: <CalendarClock className="h-4 w-4" /> },
];

export function TransfersClient({
  accounts,
  kycApproved,
}: {
  accounts: TransferAccountVM[];
  kycApproved: boolean;
}) {
  const [tab, setTab] = React.useState<Kind>("OWN");

  return (
    <div className="space-y-6">
      {!kycApproved && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="ring-glow flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning/5 p-4 text-sm backdrop-blur-xl"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-warning/15 text-warning">
            <ShieldAlert className="h-5 w-5" />
          </span>
          <div>
            <div className="font-medium">Identity verification required</div>
            <p className="text-muted-foreground">
              Complete KYC to move money. You can review the flows below, but submitting will be declined.
            </p>
          </div>
        </motion.div>
      )}

      <Tabs value={tab} onValueChange={(v) => setTab(v as Kind)} className="space-y-6">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1.5 rounded-2xl border border-border/60 bg-card/60 p-1.5 backdrop-blur-xl sm:inline-flex sm:w-auto sm:grid-cols-none">
          {TABS.map((t) => (
            <TabsTrigger
              key={t.value}
              value={t.value}
              className="group relative gap-1.5 rounded-xl px-3.5 py-2 font-medium transition-all data-[state=active]:bg-brand-gradient data-[state=active]:text-white data-[state=active]:shadow-glow"
            >
              {t.icon}
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {TABS.map((t) => (
          <TabsContent key={t.value} value={t.value} className="mt-0">
            <TransferFlow kind={t.value} accounts={accounts} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

const KIND_META: Record<
  Kind,
  { title: string; description: string; icon: React.ReactNode }
> = {
  OWN: {
    title: "Between your accounts",
    description: "Instant move between accounts you own.",
    icon: <ArrowLeftRight className="h-5 w-5" />,
  },
  P2P: {
    title: "Send to a person",
    description: "Pay another customer by email or account id.",
    icon: <Send className="h-5 w-5" />,
  },
  BANK: {
    title: "Send to a bank",
    description: "Sandbox external bank payout via settlement.",
    icon: <Banknote className="h-5 w-5" />,
  },
  QR: {
    title: "Scan & pay",
    description: "Pay a person from a scanned QR payload.",
    icon: <QrCode className="h-5 w-5" />,
  },
  SCHEDULED: {
    title: "Schedule a transfer",
    description: "Plan a transfer for a future date (sandbox note).",
    icon: <CalendarClock className="h-5 w-5" />,
  },
};

function TransferFlow({ kind, accounts }: { kind: Kind; accounts: TransferAccountVM[] }) {
  const [phase, setPhase] = React.useState<Phase>("form");
  const [draft, setDraft] = React.useState<Draft>({
    kind,
    fromAccountId: accounts[0]?.id ?? "",
    amount: "",
    note: "",
    country: "KG",
    scheduledFor: "",
  });
  const [submitting, setSubmitting] = React.useState(false);
  const [result, setResult] = React.useState<TransferResultVM | null>(null);

  const from = accountById(accounts, draft.fromAccountId);
  const meta = KIND_META[kind];

  function setField<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function reset() {
    setPhase("form");
    setResult(null);
    setDraft({
      kind,
      fromAccountId: accounts[0]?.id ?? "",
      amount: "",
      note: "",
      country: "KG",
      scheduledFor: "",
    });
  }

  // Validate the form before moving to confirm.
  function toConfirm() {
    if (!from) {
      toast.error("Choose an account to send from");
      return;
    }
    if (!draft.amount || Number(draft.amount) <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (kind === "OWN") {
      const dest = accounts.filter((a) => a.id !== draft.fromAccountId && a.currency === from.currency);
      if (!draft.toAccountId) {
        toast.error("Choose a destination account");
        return;
      }
      if (dest.length === 0) {
        toast.error("No other same-currency account to receive this transfer");
        return;
      }
    }
    if ((kind === "P2P") && !draft.recipientEmail && !draft.toAccountId) {
      toast.error("Enter a recipient email");
      return;
    }
    if (kind === "QR" && !draft.recipientEmail) {
      toast.error("Scan a QR code first");
      return;
    }
    if (kind === "BANK" && (!draft.counterpartyName || draft.counterpartyName.trim().length === 0)) {
      toast.error("Enter the beneficiary name");
      return;
    }
    if (kind === "SCHEDULED" && !draft.scheduledFor) {
      toast.error("Pick a date");
      return;
    }
    setPhase("confirm");
  }

  // Build the request payload + endpoint for the chosen kind.
  function buildRequest(): { endpoint: string; body: Record<string, unknown> } {
    const noteWithSchedule =
      kind === "SCHEDULED" && draft.scheduledFor
        ? `${draft.note ? `${draft.note} · ` : ""}Scheduled for ${draft.scheduledFor}`.slice(0, 200)
        : draft.note || undefined;

    if (kind === "OWN") {
      return {
        endpoint: "/api/transfers/internal",
        body: {
          fromAccountId: draft.fromAccountId,
          toAccountId: draft.toAccountId,
          amount: draft.amount,
          note: noteWithSchedule,
        },
      };
    }
    if (kind === "BANK") {
      return {
        endpoint: "/api/transfers/bank",
        body: {
          fromAccountId: draft.fromAccountId,
          amount: draft.amount,
          note: noteWithSchedule,
          counterparty: {
            name: draft.counterpartyName,
            ...(draft.bank ? { bank: draft.bank } : {}),
            ...(draft.country ? { country: draft.country } : {}),
          },
        },
      };
    }
    // P2P, QR, and SCHEDULED-as-p2p all use the p2p endpoint.
    return {
      endpoint: "/api/transfers/p2p",
      body: {
        fromAccountId: draft.fromAccountId,
        ...(draft.toAccountId ? { toAccountId: draft.toAccountId } : {}),
        ...(draft.recipientEmail ? { recipientEmail: draft.recipientEmail } : {}),
        amount: draft.amount,
        note: noteWithSchedule,
      },
    };
  }

  async function submit() {
    setSubmitting(true);
    const { endpoint, body } = buildRequest();
    try {
      const res = await apiFetch<TransferResultVM>(endpoint, {
        method: "POST",
        idempotencyKey: newIdempotencyKey(),
        body: JSON.stringify(body),
      });
      setResult(res);
      setPhase("receipt");
      toast.success("Transfer sent", { description: `Ref ${res.transactionId.slice(0, 8)}` });
    } catch (err) {
      // Insufficient funds / limit errors surface as toasts; stay on confirm.
      toast.error(err instanceof Error ? err.message : "Transfer failed");
    } finally {
      setSubmitting(false);
    }
  }

  const steps: { phase: Phase; label: string }[] = [
    { phase: "form", label: "Details" },
    { phase: "confirm", label: "Review" },
    { phase: "receipt", label: "Done" },
  ];
  const stepIndex = steps.findIndex((s) => s.phase === phase);

  return (
    <Card className="ring-glow glass-card overflow-hidden">
      <CardHeader className="gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-gradient text-white shadow-glow">
              {meta.icon}
            </span>
            <div>
              <CardTitle className="font-display text-lg tracking-tight">{meta.title}</CardTitle>
              <CardDescription>{meta.description}</CardDescription>
            </div>
          </div>
          {/* Step rail */}
          <div className="hidden items-center gap-1.5 pt-1 sm:flex">
            {steps.map((s, i) => (
              <React.Fragment key={s.phase}>
                <span
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i <= stepIndex ? "w-8 bg-brand-gradient" : "w-4 bg-muted"
                  }`}
                  aria-current={i === stepIndex ? "step" : undefined}
                />
              </React.Fragment>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <AnimatePresence mode="wait">
          {phase === "form" && (
            <motion.div
              key="form"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.18 }}
              className="space-y-5"
            >
              <FromAccountField
                accounts={accounts}
                value={draft.fromAccountId}
                onChange={(v) => {
                  setField("fromAccountId", v);
                  // Reset OWN destination if currency mismatched.
                  setField("toAccountId", undefined);
                }}
              />

              <KindFields kind={kind} accounts={accounts} draft={draft} from={from} setField={setField} />

              <AmountField currency={from?.currency} value={draft.amount} onChange={(v) => setField("amount", v)} />

              <div className="space-y-2">
                <Label htmlFor="note">Note (optional)</Label>
                <Input
                  id="note"
                  maxLength={200}
                  value={draft.note}
                  onChange={(e) => setField("note", e.target.value)}
                  placeholder="What's it for?"
                />
              </div>

              {from && (
                <div className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/30 px-4 py-2.5 text-xs">
                  <span className="text-muted-foreground">Available in {from.name}</span>
                  <MoneyText
                    amount={from.available}
                    currency={from.currency}
                    withSymbol
                    className="font-semibold text-foreground"
                  />
                </div>
              )}

              <Button variant="gradient" size="lg" className="w-full" onClick={toConfirm}>
                Review transfer
              </Button>
            </motion.div>
          )}

          {phase === "confirm" && from && (
            <motion.div
              key="confirm"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ type: "spring", stiffness: 220, damping: 22 }}
              className="space-y-5"
            >
              {/* Premium amount hero */}
              <div className="premium-surface ring-glow relative p-6 text-center text-white">
                <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/60">
                  You are sending
                </div>
                <AnimatedMoney
                  amount={amountToMinor(draft.amount, from.currency)}
                  currency={from.currency}
                  withSymbol
                  className="mt-2 block font-display text-4xl font-semibold leading-none tracking-tight sm:text-5xl"
                />
                <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-sm text-white/90 backdrop-blur">
                  {confirmTarget(kind, draft, accounts)}
                </div>
              </div>

              <dl className="space-y-1.5 rounded-2xl border border-border/50 bg-muted/20 p-4 text-sm">
                <Row label="From" value={`${from.name} · ${from.currency} · ••${from.displayNumber}`} />
                <Row label="Type" value={<Badge variant="secondary">{kind}</Badge>} />
                {draft.note && <Row label="Note" value={draft.note} />}
                {kind === "SCHEDULED" && draft.scheduledFor && (
                  <Row label="Scheduled" value={draft.scheduledFor} />
                )}
              </dl>

              <div className="flex gap-3">
                <Button variant="outline" size="lg" className="flex-1" onClick={() => setPhase("form")} disabled={submitting}>
                  Back
                </Button>
                <Button variant="gradient" size="lg" className="flex-1" onClick={submit} disabled={submitting}>
                  {submitting ? "Sending…" : "Confirm & send"}
                </Button>
              </div>
            </motion.div>
          )}

          {phase === "receipt" && result && from && (
            <motion.div
              key="receipt"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: "spring", stiffness: 220, damping: 20 }}
              className="space-y-5"
            >
              {/* Celebratory burst */}
              <div className="relative">
                <Confetti />
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 260, damping: 16, delay: 0.05 }}
                  className="relative mx-auto grid h-16 w-16 place-items-center rounded-full bg-success/15 text-success shadow-[0_0_0_8px_hsl(var(--success)/0.08)]"
                >
                  <CheckCircle2 className="h-8 w-8" />
                </motion.div>
              </div>

              <SuccessState
                title={kind === "SCHEDULED" ? "Transfer scheduled (sandbox)" : "Transfer complete"}
                description={`Reference ${result.transactionId.slice(0, 8).toUpperCase()}`}
              />

              <dl className="space-y-1.5 rounded-2xl border border-border/50 bg-muted/20 p-4 text-sm">
                <Row
                  label="Amount"
                  value={<MoneyText amount={amountToMinor(draft.amount, result.currency)} currency={result.currency} withSymbol />}
                />
                <Row label="Fee" value={<MoneyText amount={result.fee} currency={result.currency} withSymbol />} />
                <Row label="Status" value={<StatusBadge status={result.status} />} />
                <Row
                  label="New balance"
                  value={<MoneyText amount={result.fromBalanceAfter} currency={result.currency} withSymbol />}
                />
                {result.toBalanceAfter !== null && (
                  <Row
                    label="Recipient balance"
                    value={<MoneyText amount={result.toBalanceAfter} currency={result.currency} withSymbol />}
                  />
                )}
                {result.alerts > 0 && (
                  <Row
                    label="Compliance"
                    value={
                      <Badge variant="warning">
                        <ShieldAlert className="mr-1 h-3 w-3" /> {result.alerts} alert
                        {result.alerts === 1 ? "" : "s"}
                      </Badge>
                    }
                  />
                )}
              </dl>

              <div className="flex items-center justify-center gap-2 text-success">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-xs">Saved to your activity</span>
              </div>

              <Button variant="gradient" size="lg" className="w-full" onClick={reset}>
                New transfer
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}

/** Lightweight celebratory confetti burst — pure framer-motion, no deps. */
function Confetti() {
  const pieces = React.useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        id: i,
        x: (Math.random() - 0.5) * 220,
        y: 40 + Math.random() * 90,
        rotate: Math.random() * 360,
        delay: Math.random() * 0.12,
        color: ["bg-brand-violet", "bg-brand-cyan", "bg-brand-emerald", "bg-brand-blue"][i % 4]!,
      })),
    [],
  );
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 mx-auto h-0 w-0" aria-hidden>
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          initial={{ opacity: 1, x: 0, y: 0, rotate: 0 }}
          animate={{ opacity: 0, x: p.x, y: p.y, rotate: p.rotate }}
          transition={{ duration: 1.1, delay: p.delay, ease: "easeOut" }}
          className={`absolute h-2 w-1.5 rounded-[1px] ${p.color}`}
        />
      ))}
    </div>
  );
}

// --- Field components ---------------------------------------------------------

function FromAccountField({
  accounts,
  value,
  onChange,
}: {
  accounts: TransferAccountVM[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>From account</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Select account" />
        </SelectTrigger>
        <SelectContent>
          {accounts.map((a) => (
            <SelectItem key={a.id} value={a.id}>
              {a.name} · {a.currency} · ••{a.displayNumber}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function AmountField({
  currency,
  value,
  onChange,
}: {
  currency?: Currency;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor="amount">Amount</Label>
      <div className="relative">
        {currency && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 rounded-md bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
            {currency}
          </span>
        )}
        <Input
          id="amount"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ""))}
          placeholder="0.00"
          className={`h-12 text-2xl font-semibold tabular-nums ${currency ? "pl-16" : ""}`}
        />
      </div>
    </div>
  );
}

function KindFields({
  kind,
  accounts,
  draft,
  from,
  setField,
}: {
  kind: Kind;
  accounts: TransferAccountVM[];
  draft: Draft;
  from: TransferAccountVM | undefined;
  setField: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
}) {
  if (kind === "OWN" || kind === "SCHEDULED") {
    const dests = accounts.filter(
      (a) => a.id !== draft.fromAccountId && (!from || a.currency === from.currency),
    );
    return (
      <>
        <div className="space-y-2">
          <Label>To account</Label>
          <Select
            value={draft.toAccountId ?? ""}
            onValueChange={(v) => setField("toAccountId", v)}
            disabled={dests.length === 0}
          >
            <SelectTrigger>
              <SelectValue placeholder={dests.length === 0 ? "No eligible account" : "Select destination"} />
            </SelectTrigger>
            <SelectContent>
              {dests.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name} · {a.currency} · ••{a.displayNumber}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {kind === "SCHEDULED" && (
          <div className="space-y-2">
            <Label htmlFor="schedule">Send on</Label>
            <Input
              id="schedule"
              type="date"
              value={draft.scheduledFor ?? ""}
              onChange={(e) => setField("scheduledFor", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Sandbox: the transfer posts now and the date is recorded in the note.
            </p>
          </div>
        )}
      </>
    );
  }

  if (kind === "P2P") {
    return (
      <div className="space-y-2">
        <Label htmlFor="recipient">Recipient email</Label>
        <Input
          id="recipient"
          type="email"
          value={draft.recipientEmail ?? ""}
          onChange={(e) => setField("recipientEmail", e.target.value)}
          placeholder="name@example.com"
        />
        <p className="text-xs text-muted-foreground">
          We route to the recipient&apos;s {from?.currency ?? ""} account.
        </p>
      </div>
    );
  }

  if (kind === "QR") {
    return <QrField draft={draft} setField={setField} />;
  }

  // BANK
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="beneficiary">Beneficiary name</Label>
        <Input
          id="beneficiary"
          maxLength={120}
          value={draft.counterpartyName ?? ""}
          onChange={(e) => setField("counterpartyName", e.target.value)}
          placeholder="e.g. Jane Roe"
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="bank">Bank (optional)</Label>
          <Input
            id="bank"
            maxLength={120}
            value={draft.bank ?? ""}
            onChange={(e) => setField("bank", e.target.value)}
            placeholder="e.g. Demosbank"
          />
        </div>
        <div className="space-y-2">
          <Label>Country</Label>
          <Select value={draft.country ?? "KG"} onValueChange={(v) => setField("country", v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COUNTRIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </>
  );
}

function QrField({
  draft,
  setField,
}: {
  draft: Draft;
  setField: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
}) {
  // Faux "scanned" payloads — a real app would decode a camera scan here.
  const FAUX = [
    { email: "merchant@neobank.dev", label: "Aurora Coffee", amount: "4.50" },
    { email: "demo@neobank.dev", label: "Demo Friend", amount: "" },
  ];
  const scanned = Boolean(draft.recipientEmail);

  return (
    <div
      className={`space-y-3 rounded-2xl border p-4 transition-colors ${
        scanned ? "border-success/40 bg-success/5" : "border-border/60 bg-muted/20"
      }`}
    >
      <div className="flex items-center gap-3">
        <motion.div
          key={scanned ? "scanned" : "idle"}
          initial={{ scale: 0.9, opacity: 0.6 }}
          animate={{ scale: 1, opacity: 1 }}
          className={`grid h-12 w-12 place-items-center rounded-xl ${
            scanned ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
          }`}
        >
          {scanned ? <CheckCircle2 className="h-6 w-6" /> : <QrCode className="h-6 w-6" />}
        </motion.div>
        <div className="min-w-0 text-sm">
          {scanned ? (
            <>
              <div className="truncate font-medium">Scanned: {draft.recipientEmail}</div>
              <div className="text-xs text-muted-foreground">Routes via P2P</div>
            </>
          ) : (
            <div className="text-muted-foreground">Scan a payment QR to continue.</div>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {FAUX.map((f) => (
          <Button
            key={f.email}
            variant="outline"
            size="sm"
            onClick={() => {
              setField("recipientEmail", f.email);
              if (f.amount) setField("amount", f.amount);
            }}
          >
            <QrCode className="h-4 w-4" /> Scan {f.label}
          </Button>
        ))}
        {scanned && (
          <Button variant="ghost" size="sm" onClick={() => setField("recipientEmail", undefined)}>
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}

// --- Small presentational helpers --------------------------------------------

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border/40 pb-2 last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium tabular-nums">{value}</dd>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "COMPLETED") return <Badge variant="success">Completed</Badge>;
  if (status === "PENDING") return <Badge variant="warning">Pending</Badge>;
  if (status === "FAILED") return <Badge variant="destructive">Failed</Badge>;
  return <Badge variant="secondary">{status}</Badge>;
}

function confirmTarget(kind: Kind, draft: Draft, accounts: TransferAccountVM[]): string {
  if (kind === "OWN" || kind === "SCHEDULED") {
    const to = draft.toAccountId ? accountById(accounts, draft.toAccountId) : undefined;
    return to ? `to ${to.name} · ••${to.displayNumber}` : "to your account";
  }
  if (kind === "BANK") {
    return `to ${draft.counterpartyName ?? "beneficiary"}${draft.bank ? ` · ${draft.bank}` : ""}`;
  }
  return `to ${draft.recipientEmail ?? "recipient"}`;
}

// UI-local minor-units conversion for display only (2 decimals for all
// supported currencies). The API performs the authoritative parsing.
function amountToMinor(amount: string, _currency: Currency): string {
  const cleaned = amount.trim() === "" ? "0" : amount;
  const neg = cleaned.startsWith("-");
  const unsigned = neg ? cleaned.slice(1) : cleaned;
  const [whole = "0", frac = ""] = unsigned.split(".");
  const padded = frac.slice(0, 2).padEnd(2, "0");
  const combined = `${whole}${padded}`.replace(/^0+(?=\d)/, "");
  return `${neg ? "-" : ""}${combined === "" ? "0" : combined}`;
}
