"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Atom,
  CreditCard,
  Lock,
  Plus,
  Settings2,
  ShieldCheck,
  ShoppingBag,
  Snowflake,
  Store,
  Wifi,
  Globe,
} from "lucide-react";
import { Currency } from "@prisma/client";
import { toast } from "sonner";
import { VirtualCard } from "@/components/brand/virtual-card";
import { MoneyText } from "@/components/brand/money-text";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/brand/states";
import { apiFetch, newIdempotencyKey } from "@/lib/client";

// --- View models (BigInt already serialized to strings on the server) --------

interface CardLimitVM {
  dailyLimit: string;
  monthlyLimit: string;
  perTxLimit: string;
  atmDailyLimit: string;
}

interface MerchantControlVM {
  id: string;
  mcc: string;
  label: string;
  blocked: boolean;
}

export interface CardVM {
  id: string;
  accountId: string;
  accountName: string;
  status: "ACTIVE" | "FROZEN" | "CLOSED";
  last4: string;
  brand: string;
  expMonth: number;
  expYear: number;
  cardholderName: string;
  currency: Currency;
  onlinePaymentsEnabled: boolean;
  atmEnabled: boolean;
  contactlessEnabled: boolean;
  availableBalance: string;
  limit: CardLimitVM;
  merchantControls: MerchantControlVM[];
}

interface AccountVM {
  id: string;
  name: string;
  currency: Currency;
  displayNumber: string;
}

// Minor-units helpers (UI-local; the API does the authoritative parsing).
// All supported currencies (KGS/USD/EUR) use 2 minor-unit digits.
function minorToDecimal(minor: string, _currency: Currency): string {
  const decimals = 2;
  const neg = minor.startsWith("-");
  const digits = (neg ? minor.slice(1) : minor).padStart(decimals + 1, "0");
  const whole = digits.slice(0, digits.length - decimals);
  const frac = digits.slice(digits.length - decimals);
  return `${neg ? "-" : ""}${whole}.${frac}`;
}

const MCC_OPTIONS: { value: string; label: string }[] = [
  { value: "5411", label: "Groceries (5411)" },
  { value: "5812", label: "Restaurants (5812)" },
  { value: "5814", label: "Fast food (5814)" },
  { value: "4111", label: "Transport (4111)" },
  { value: "5541", label: "Fuel (5541)" },
  { value: "5912", label: "Pharmacy (5912)" },
  { value: "5732", label: "Electronics (5732)" },
  { value: "7995", label: "Gambling (7995)" },
  { value: "6011", label: "ATM / Cash (6011)" },
];

function statusBadge(status: CardVM["status"]) {
  if (status === "ACTIVE") return <Badge variant="success">Active</Badge>;
  if (status === "FROZEN") return <Badge variant="warning">Frozen</Badge>;
  return <Badge variant="destructive">Closed</Badge>;
}

export function CardsClient({
  initialCards,
  accounts,
  defaultCardholder,
}: {
  initialCards: CardVM[];
  accounts: AccountVM[];
  defaultCardholder: string;
}) {
  const [cards, setCards] = React.useState<CardVM[]>(initialCards);
  const [pending, setPending] = React.useState<string | null>(null);

  // Dialog state
  const [createOpen, setCreateOpen] = React.useState(false);
  const [limitsCard, setLimitsCard] = React.useState<CardVM | null>(null);
  const [purchaseCard, setPurchaseCard] = React.useState<CardVM | null>(null);

  const patchLimit = React.useCallback((id: string, patch: Partial<CardVM>) => {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }, []);

  // --- Freeze / Unfreeze -----------------------------------------------------
  async function toggleFreeze(card: CardVM) {
    const next = card.status === "FROZEN" ? "unfreeze" : "freeze";
    setPending(card.id);
    try {
      const res = await apiFetch<{ id: string; status: CardVM["status"] }>(
        `/api/cards/${card.id}/${next}`,
        { method: "POST" },
      );
      patchLimit(card.id, { status: res.status });
      toast.success(next === "freeze" ? "Card frozen" : "Card unfrozen", {
        description: `Card ending ${card.last4}`,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update card");
    } finally {
      setPending(null);
    }
  }

  // --- Toggle a single control (online/atm/contactless) ----------------------
  async function toggleControl(
    card: CardVM,
    field: "onlinePaymentsEnabled" | "atmEnabled" | "contactlessEnabled",
    value: boolean,
  ) {
    // Optimistic update.
    patchLimit(card.id, { [field]: value } as Partial<CardVM>);
    setPending(card.id);
    try {
      await apiFetch(`/api/cards/${card.id}/limits`, {
        method: "PATCH",
        body: JSON.stringify({ [field]: value }),
      });
      toast.success("Card controls updated");
    } catch (err) {
      // Revert on failure.
      patchLimit(card.id, { [field]: !value } as Partial<CardVM>);
      toast.error(err instanceof Error ? err.message : "Could not update controls");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {cards.length} {cards.length === 1 ? "card" : "cards"}
        </p>
        <Button
          variant="gradient"
          onClick={() => setCreateOpen(true)}
          disabled={accounts.length === 0}
        >
          <Plus className="h-4 w-4" /> Create virtual card
        </Button>
      </div>

      {cards.length === 0 ? (
        <EmptyState
          icon={<CreditCard className="h-6 w-6" />}
          title="No cards yet"
          description="Issue your first virtual debit card to start spending online."
          action={
            <Button variant="gradient" onClick={() => setCreateOpen(true)} disabled={accounts.length === 0}>
              <Plus className="h-4 w-4" /> Create virtual card
            </Button>
          }
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {cards.map((card, i) => (
            <motion.div
              key={card.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.05, 0.3), type: "spring", stiffness: 120, damping: 18 }}
            >
              <Card className="overflow-hidden">
                <CardHeader className="gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <CardTitle className="flex items-center gap-2">
                        Virtual debit {statusBadge(card.status)}
                      </CardTitle>
                      <CardDescription>
                        {card.accountName} · Available{" "}
                        <MoneyText
                          amount={card.availableBalance}
                          currency={card.currency}
                          className="font-medium text-foreground"
                        />
                      </CardDescription>
                    </div>
                  </div>

                  <VirtualCard
                    last4={card.last4}
                    holder={card.cardholderName}
                    expMonth={card.expMonth}
                    expYear={card.expYear}
                    currency={card.currency}
                    brand={card.brand}
                    frozen={card.status !== "ACTIVE"}
                  />
                </CardHeader>

                <CardContent className="space-y-5">
                  {/* Primary actions */}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={card.status === "FROZEN" ? "gradient" : "outline"}
                      size="sm"
                      onClick={() => toggleFreeze(card)}
                      disabled={pending === card.id || card.status === "CLOSED"}
                    >
                      <Snowflake className="h-4 w-4" />
                      {card.status === "FROZEN" ? "Unfreeze" : "Freeze"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setLimitsCard(card)}
                      disabled={card.status === "CLOSED"}
                    >
                      <Settings2 className="h-4 w-4" /> Edit limits
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setPurchaseCard(card)}
                      disabled={card.status !== "ACTIVE"}
                    >
                      <ShoppingBag className="h-4 w-4" /> Simulate purchase
                    </Button>
                  </div>

                  {/* Control toggles */}
                  <div className="space-y-3 rounded-xl border border-border/60 p-4">
                    <ControlRow
                      icon={<Globe className="h-4 w-4 text-muted-foreground" />}
                      label="Online payments"
                      description="Allow e-commerce & subscriptions"
                      checked={card.onlinePaymentsEnabled}
                      disabled={pending === card.id || card.status === "CLOSED"}
                      onChange={(v) => toggleControl(card, "onlinePaymentsEnabled", v)}
                    />
                    <ControlRow
                      icon={<Atom className="h-4 w-4 text-muted-foreground" />}
                      label="ATM withdrawals"
                      description="Cash at ATMs"
                      checked={card.atmEnabled}
                      disabled={pending === card.id || card.status === "CLOSED"}
                      onChange={(v) => toggleControl(card, "atmEnabled", v)}
                    />
                    <ControlRow
                      icon={<Wifi className="h-4 w-4 text-muted-foreground" />}
                      label="Contactless"
                      description="Tap to pay in store"
                      checked={card.contactlessEnabled}
                      disabled={pending === card.id || card.status === "CLOSED"}
                      onChange={(v) => toggleControl(card, "contactlessEnabled", v)}
                    />
                  </div>

                  {/* Limits summary */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <LimitStat label="Per transaction" amount={card.limit.perTxLimit} currency={card.currency} />
                    <LimitStat label="Daily" amount={card.limit.dailyLimit} currency={card.currency} />
                    <LimitStat label="Monthly" amount={card.limit.monthlyLimit} currency={card.currency} />
                    <LimitStat label="ATM daily" amount={card.limit.atmDailyLimit} currency={card.currency} />
                  </div>

                  {/* Merchant controls */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Store className="h-4 w-4 text-muted-foreground" /> Merchant controls
                    </div>
                    {card.merchantControls.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No category rules. All allowed merchant categories are accepted.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {card.merchantControls.map((m) => (
                          <Badge key={m.id} variant={m.blocked ? "destructive" : "secondary"}>
                            {m.blocked ? <Lock className="mr-1 h-3 w-3" /> : <ShieldCheck className="mr-1 h-3 w-3" />}
                            {m.label}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <CreateCardDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        accounts={accounts}
        defaultCardholder={defaultCardholder}
        onCreated={(card) => setCards((prev) => [card, ...prev])}
      />

      {limitsCard && (
        <EditLimitsDialog
          card={limitsCard}
          onOpenChange={(o) => !o && setLimitsCard(null)}
          onSaved={(limit) => patchLimit(limitsCard.id, { limit })}
        />
      )}

      {purchaseCard && (
        <SimulatePurchaseDialog
          card={purchaseCard}
          onOpenChange={(o) => !o && setPurchaseCard(null)}
          onSettled={(availableBalance) => patchLimit(purchaseCard.id, { availableBalance })}
        />
      )}
    </div>
  );
}

// --- Sub-components -----------------------------------------------------------

function ControlRow({
  icon,
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        {icon}
        <div>
          <div className="text-sm font-medium">{label}</div>
          <div className="text-xs text-muted-foreground">{description}</div>
        </div>
      </div>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} aria-label={label} />
    </div>
  );
}

function LimitStat({ label, amount, currency }: { label: string; amount: string; currency: Currency }) {
  const unlimited = amount === "0";
  return (
    <div className="rounded-lg border border-border/50 bg-background/40 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-semibold tabular-nums">
        {unlimited ? "No limit" : <MoneyText amount={amount} currency={currency} />}
      </div>
    </div>
  );
}

// --- Create card -------------------------------------------------------------

function CreateCardDialog({
  open,
  onOpenChange,
  accounts,
  defaultCardholder,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  accounts: AccountVM[];
  defaultCardholder: string;
  onCreated: (card: CardVM) => void;
}) {
  const [accountId, setAccountId] = React.useState<string>(accounts[0]?.id ?? "");
  const [cardholderName, setCardholderName] = React.useState(defaultCardholder);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setAccountId(accounts[0]?.id ?? "");
      setCardholderName(defaultCardholder);
    }
  }, [open, accounts, defaultCardholder]);

  async function submit() {
    if (!accountId) {
      toast.error("Select an account");
      return;
    }
    if (cardholderName.trim().length === 0) {
      toast.error("Cardholder name is required");
      return;
    }
    setSubmitting(true);
    try {
      const created = await apiFetch<{
        id: string;
        accountId: string;
        status: CardVM["status"];
        last4: string;
        brand: string;
        expMonth: number;
        expYear: number;
        cardholderName: string;
        onlinePaymentsEnabled: boolean;
        atmEnabled: boolean;
        contactlessEnabled: boolean;
        limit: CardLimitVM | null;
      }>("/api/cards", {
        method: "POST",
        body: JSON.stringify({ accountId, cardholderName: cardholderName.trim() }),
      });
      const account = accounts.find((a) => a.id === accountId);
      onCreated({
        id: created.id,
        accountId: created.accountId,
        accountName: account?.name ?? "Account",
        status: created.status,
        last4: created.last4,
        brand: created.brand,
        expMonth: created.expMonth,
        expYear: created.expYear,
        cardholderName: created.cardholderName,
        currency: account?.currency ?? "USD",
        onlinePaymentsEnabled: created.onlinePaymentsEnabled,
        atmEnabled: created.atmEnabled,
        contactlessEnabled: created.contactlessEnabled,
        availableBalance: "0",
        limit: created.limit ?? {
          dailyLimit: "0",
          monthlyLimit: "0",
          perTxLimit: "0",
          atmDailyLimit: "0",
        },
        merchantControls: [],
      });
      toast.success("Virtual card created", { description: `Ending ${created.last4}` });
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create card");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create virtual card</DialogTitle>
          <DialogDescription>
            Issue a new virtual debit card linked to one of your accounts. No physical card, no real PAN.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Linked account</Label>
            <Select value={accountId} onValueChange={setAccountId}>
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
          <div className="space-y-2">
            <Label htmlFor="cardholder">Cardholder name</Label>
            <Input
              id="cardholder"
              value={cardholderName}
              maxLength={80}
              onChange={(e) => setCardholderName(e.target.value)}
              placeholder="Name on card"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="gradient" onClick={submit} disabled={submitting || !accountId}>
            {submitting ? "Creating…" : "Create card"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Edit limits -------------------------------------------------------------

function EditLimitsDialog({
  card,
  onOpenChange,
  onSaved,
}: {
  card: CardVM;
  onOpenChange: (o: boolean) => void;
  onSaved: (limit: CardLimitVM) => void;
}) {
  const [perTx, setPerTx] = React.useState(minorToDecimal(card.limit.perTxLimit, card.currency));
  const [daily, setDaily] = React.useState(minorToDecimal(card.limit.dailyLimit, card.currency));
  const [monthly, setMonthly] = React.useState(minorToDecimal(card.limit.monthlyLimit, card.currency));
  const [atmDaily, setAtmDaily] = React.useState(minorToDecimal(card.limit.atmDailyLimit, card.currency));
  const [submitting, setSubmitting] = React.useState(false);

  async function submit() {
    setSubmitting(true);
    try {
      const res = await apiFetch<{ limit: CardLimitVM }>(`/api/cards/${card.id}/limits`, {
        method: "PATCH",
        body: JSON.stringify({
          perTxLimit: perTx || "0",
          dailyLimit: daily || "0",
          monthlyLimit: monthly || "0",
          atmDailyLimit: atmDaily || "0",
        }),
      });
      onSaved(res.limit);
      toast.success("Limits updated");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update limits");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit card limits</DialogTitle>
          <DialogDescription>
            Set spending limits in {card.currency}. Use 0 for no limit. Card ending {card.last4}.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <LimitInput label="Per transaction" value={perTx} onChange={setPerTx} currency={card.currency} />
          <LimitInput label="Daily" value={daily} onChange={setDaily} currency={card.currency} />
          <LimitInput label="Monthly" value={monthly} onChange={setMonthly} currency={card.currency} />
          <LimitInput label="ATM daily" value={atmDaily} onChange={setAtmDaily} currency={card.currency} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="gradient" onClick={submit} disabled={submitting}>
            {submitting ? "Saving…" : "Save limits"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LimitInput({
  label,
  value,
  onChange,
  currency,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  currency: Currency;
}) {
  return (
    <div className="space-y-2">
      <Label>
        {label} <span className="text-muted-foreground">({currency})</span>
      </Label>
      <Input
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ""))}
        placeholder="0.00"
      />
    </div>
  );
}

// --- Simulate purchase -------------------------------------------------------

interface PurchaseResult {
  reference: string;
  status: string;
  amount: string;
  fee: string;
  currency: Currency;
  balanceAfter: string;
  availableAfter: string;
}

function SimulatePurchaseDialog({
  card,
  onOpenChange,
  onSettled,
}: {
  card: CardVM;
  onOpenChange: (o: boolean) => void;
  onSettled: (availableBalance: string) => void;
}) {
  const [merchant, setMerchant] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [mcc, setMcc] = React.useState(MCC_OPTIONS[0]?.value ?? "5411");
  const [submitting, setSubmitting] = React.useState(false);
  const [result, setResult] = React.useState<PurchaseResult | null>(null);

  async function submit() {
    if (merchant.trim().length === 0) {
      toast.error("Enter a merchant name");
      return;
    }
    if (!amount || Number(amount) <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiFetch<PurchaseResult>(`/api/cards/${card.id}/simulate-purchase`, {
        method: "POST",
        idempotencyKey: newIdempotencyKey(),
        body: JSON.stringify({
          amount,
          merchantName: merchant.trim(),
          mcc,
          capture: true,
        }),
      });
      setResult(res);
      onSettled(res.availableAfter);
      toast.success("Payment approved", {
        description: `${merchant.trim()} · ref ${res.reference}`,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Purchase declined");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Simulate a card purchase</DialogTitle>
          <DialogDescription>
            Run a sandbox authorization against card ending {card.last4} ({card.currency}).
          </DialogDescription>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {result ? (
            <motion.div
              key="receipt"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 20 }}
              className="space-y-4"
            >
              <div className="rounded-xl border border-success/30 bg-success/5 p-5 text-center">
                <ShoppingBag className="mx-auto mb-2 h-6 w-6 text-success" />
                <div className="text-sm font-semibold text-success">Payment approved</div>
                <div className="mt-1 text-2xl font-bold tabular-nums">
                  <MoneyText amount={result.amount} currency={result.currency} withSymbol />
                </div>
                <div className="text-xs text-muted-foreground">at {merchant.trim()}</div>
              </div>
              <dl className="space-y-2 text-sm">
                <ReceiptRow label="Reference" value={result.reference} />
                <ReceiptRow label="Status" value={result.status} />
                <ReceiptRow
                  label="Fee"
                  value={<MoneyText amount={result.fee} currency={result.currency} />}
                />
                <ReceiptRow
                  label="New balance"
                  value={<MoneyText amount={result.balanceAfter} currency={result.currency} />}
                />
                <ReceiptRow
                  label="Available"
                  value={<MoneyText amount={result.availableAfter} currency={result.currency} />}
                />
              </dl>
              <DialogFooter>
                <Button variant="gradient" onClick={() => onOpenChange(false)}>
                  Done
                </Button>
              </DialogFooter>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="merchant">Merchant</Label>
                <Input
                  id="merchant"
                  value={merchant}
                  maxLength={120}
                  onChange={(e) => setMerchant(e.target.value)}
                  placeholder="e.g. Aurora Coffee"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="purchase-amount">Amount ({card.currency})</Label>
                <Input
                  id="purchase-amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Merchant category</Label>
                <Select value={mcc} onValueChange={setMcc}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MCC_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
                  Cancel
                </Button>
                <Button variant="gradient" onClick={submit} disabled={submitting}>
                  {submitting ? "Processing…" : "Charge card"}
                </Button>
              </DialogFooter>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}

function ReceiptRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border/40 pb-2 last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}
