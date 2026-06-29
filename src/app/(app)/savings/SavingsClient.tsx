"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Coins,
  PiggyBank,
  Plus,
  Repeat,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { Currency, SavingsGoalStatus } from "@prisma/client";
import { toast } from "sonner";
import { MoneyText } from "@/components/brand/money-text";
import { EmptyState } from "@/components/brand/states";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
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

// --- View models (BigInt serialized to strings on the server) ----------------

export interface SavingsGoalVM {
  id: string;
  name: string;
  currency: Currency;
  targetAmount: string; // minor units
  currentAmount: string; // minor units
  status: SavingsGoalStatus;
  color: string | null;
  targetDate: string | null;
  roundUp: boolean;
  recurring: boolean;
  recurringAmount: string | null;
}

export interface AccountVM {
  id: string;
  name: string;
  currency: Currency;
  displayNumber: string;
}

const GOAL_COLORS = ["#6366f1", "#38bdf8", "#10b981", "#f59e0b", "#a855f7", "#ef4444"];

// All supported currencies use 2 minor-unit digits.
function decimalToMinor(value: string): bigint {
  const clean = value.replace(/[^\d.]/g, "");
  if (!clean) return 0n;
  const [whole = "0", frac = ""] = clean.split(".");
  const cents = (frac + "00").slice(0, 2);
  return BigInt(whole || "0") * 100n + BigInt(cents || "0");
}

function pctOf(current: string, target: string): number {
  const c = Number(current);
  const t = Number(target);
  if (!Number.isFinite(c) || !Number.isFinite(t) || t <= 0) return 0;
  return Math.min(100, Math.max(0, (c / t) * 100));
}

export function SavingsClient({
  initialGoals,
  accounts,
  defaultCurrency,
}: {
  initialGoals: SavingsGoalVM[];
  accounts: AccountVM[];
  defaultCurrency: Currency;
}) {
  const [goals, setGoals] = React.useState<SavingsGoalVM[]>(initialGoals);
  const [createOpen, setCreateOpen] = React.useState(false);

  const totalSaved = goals.reduce((s, g) => s + BigInt(g.currentAmount), 0n);
  const totalTarget = goals.reduce((s, g) => s + BigInt(g.targetAmount), 0n);
  const overallPct =
    totalTarget > 0n ? Number((totalSaved * 1000n) / totalTarget) / 10 : 0;

  function patchGoal(id: string, patch: Partial<SavingsGoalVM>) {
    setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  }

  // Sandbox: stub a POST. No /api/savings route exists, so we update optimistically.
  function toggleRule(
    goal: SavingsGoalVM,
    field: "roundUp" | "recurring",
    value: boolean,
  ) {
    patchGoal(goal.id, { [field]: value } as Partial<SavingsGoalVM>);
    toast("Sandbox", {
      description: `${field === "roundUp" ? "Round-up" : "Recurring auto-save"} ${
        value ? "enabled" : "disabled"
      } for ${goal.name}.`,
    });
  }

  function addGoal(goal: SavingsGoalVM) {
    setGoals((prev) => [goal, ...prev]);
  }

  return (
    <div className="space-y-6">
      {/* Hero summary */}
      <Card className="premium-surface border-white/10 p-0 text-white">
        <div className="bg-radial-glow grid gap-6 p-6 md:grid-cols-[1.3fr_1fr] md:p-8">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-white/70">
              <PiggyBank className="h-4 w-4" /> Total saved across vaults
            </div>
            <div className="text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl">
              <MoneyText amount={totalSaved.toString()} currency={defaultCurrency} withSymbol />
            </div>
            {totalTarget > 0n && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm text-white/70">
                  <span>{overallPct.toFixed(1)}% of all goals</span>
                  <span className="tabular-nums">
                    <MoneyText amount={totalTarget.toString()} currency={defaultCurrency} withSymbol />
                  </span>
                </div>
                <Progress
                  value={overallPct}
                  className="bg-white/15"
                  indicatorClassName="bg-white"
                />
              </div>
            )}
          </div>
          <div className="flex flex-col justify-end gap-3">
            <Button
              variant="gradient"
              onClick={() => setCreateOpen(true)}
              disabled={accounts.length === 0}
            >
              <Plus className="h-4 w-4" /> Create goal
            </Button>
            <p className="text-xs leading-snug text-white/60">
              Sandbox vaults. Auto-save rules are simulated — no real money moves.
            </p>
          </div>
        </div>
      </Card>

      {goals.length === 0 ? (
        <EmptyState
          icon={<Target className="h-6 w-6" />}
          title="No savings goals yet"
          description="Create your first vault — a holiday, an emergency fund, a new laptop — and let auto-save do the work."
          action={
            <Button
              variant="gradient"
              onClick={() => setCreateOpen(true)}
              disabled={accounts.length === 0}
            >
              <Plus className="h-4 w-4" /> Create goal
            </Button>
          }
        />
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {goals.map((goal, i) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              index={i}
              onToggleRule={toggleRule}
            />
          ))}
        </div>
      )}

      {/* Round-up simulation */}
      <RoundUpSimulation currency={defaultCurrency} />

      <CreateGoalDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        accounts={accounts}
        defaultCurrency={defaultCurrency}
        onCreated={addGoal}
      />
    </div>
  );
}

// --- Goal card ----------------------------------------------------------------

function GoalCard({
  goal,
  index,
  onToggleRule,
}: {
  goal: SavingsGoalVM;
  index: number;
  onToggleRule: (goal: SavingsGoalVM, field: "roundUp" | "recurring", value: boolean) => void;
}) {
  const pct = pctOf(goal.currentAmount, goal.targetAmount);
  const accent = goal.color ?? GOAL_COLORS[index % GOAL_COLORS.length];
  const completed = goal.status === "COMPLETED" || pct >= 100;
  const remaining = BigInt(goal.targetAmount) - BigInt(goal.currentAmount);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.05, 0.3), type: "spring", stiffness: 120, damping: 18 }}
    >
      <Card className="relative h-full overflow-hidden">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-24 opacity-20"
          style={{ background: `radial-gradient(120% 80% at 50% 0%, ${accent}, transparent)` }}
        />
        <CardHeader className="relative">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span
                className="flex h-11 w-11 items-center justify-center rounded-xl text-white"
                style={{ backgroundColor: accent }}
              >
                <PiggyBank className="h-5 w-5" />
              </span>
              <div>
                <CardTitle className="text-base">{goal.name}</CardTitle>
                <CardDescription>
                  {goal.targetDate
                    ? `By ${new Date(goal.targetDate).toLocaleDateString(undefined, {
                        month: "short",
                        year: "numeric",
                      })}`
                    : "No target date"}
                </CardDescription>
              </div>
            </div>
            {completed ? (
              <Badge variant="success">Reached</Badge>
            ) : (
              <Badge variant="secondary">{Math.round(pct)}%</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="relative space-y-5">
          <div className="space-y-2">
            <div className="flex items-end justify-between">
              <div className="text-2xl font-semibold tracking-tight tabular-nums">
                <MoneyText amount={goal.currentAmount} currency={goal.currency} withSymbol />
              </div>
              <div className="text-sm text-muted-foreground">
                of <MoneyText amount={goal.targetAmount} currency={goal.currency} withSymbol />
              </div>
            </div>
            <Progress value={pct} indicatorClassName={completed ? "bg-success" : undefined} />
            {!completed && remaining > 0n && (
              <p className="text-xs text-muted-foreground">
                <MoneyText amount={remaining.toString()} currency={goal.currency} withSymbol /> to go
              </p>
            )}
          </div>

          {/* Auto-save rules */}
          <div className="space-y-3 rounded-xl border border-border/60 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Coins className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">Round-up</div>
                  <div className="text-xs text-muted-foreground">Round purchases to the nearest unit</div>
                </div>
              </div>
              <Switch
                checked={goal.roundUp}
                onCheckedChange={(v) => onToggleRule(goal, "roundUp", v)}
                aria-label="Round-up auto-save"
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Repeat className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">Recurring</div>
                  <div className="text-xs text-muted-foreground">
                    {goal.recurringAmount ? (
                      <>
                        <MoneyText amount={goal.recurringAmount} currency={goal.currency} withSymbol />{" "}
                        weekly
                      </>
                    ) : (
                      "Auto-deposit on a schedule"
                    )}
                  </div>
                </div>
              </div>
              <Switch
                checked={goal.recurring}
                onCheckedChange={(v) => onToggleRule(goal, "recurring", v)}
                aria-label="Recurring auto-save"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// --- Round-up simulation illustration ----------------------------------------

const ROUNDUP_EXAMPLES = [
  { merchant: "Aurora Coffee", spent: "3.40", roundup: "0.60" },
  { merchant: "Metro Transit", spent: "1.25", roundup: "0.75" },
  { merchant: "Fresh Market", spent: "27.10", roundup: "0.90" },
  { merchant: "Cloud Music", spent: "9.99", roundup: "0.01" },
];

function RoundUpSimulation({ currency }: { currency: Currency }) {
  const totalRoundup = ROUNDUP_EXAMPLES.reduce(
    (s, e) => s + decimalToMinor(e.roundup),
    0n,
  );
  return (
    <Card className="glass-card overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-gradient text-white shadow-glow">
            <Sparkles className="h-4 w-4" />
          </span>
          How round-up works
        </CardTitle>
        <CardDescription>
          Every card purchase is rounded up to the nearest unit, and the spare change is swept into
          your vault.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2">
          {ROUNDUP_EXAMPLES.map((e, i) => (
            <motion.div
              key={e.merchant}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i * 0.06, 0.3) }}
              className="flex items-center justify-between rounded-lg border border-border/50 bg-background/40 p-3"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{e.merchant}</div>
                <div className="text-xs text-muted-foreground">
                  Spent{" "}
                  <MoneyText
                    amount={decimalToMinor(e.spent).toString()}
                    currency={currency}
                    withSymbol
                  />
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-sm font-semibold text-success">
                <TrendingUp className="h-3.5 w-3.5" />+
                <MoneyText
                  amount={decimalToMinor(e.roundup).toString()}
                  currency={currency}
                  withSymbol
                />
              </div>
            </motion.div>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 p-4">
          <span className="text-sm font-medium">Swept into savings from these 4 purchases</span>
          <span className="text-lg font-semibold tabular-nums text-primary">
            <MoneyText amount={totalRoundup.toString()} currency={currency} withSymbol />
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// --- Create goal dialog -------------------------------------------------------

function CreateGoalDialog({
  open,
  onOpenChange,
  accounts,
  defaultCurrency,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  accounts: AccountVM[];
  defaultCurrency: Currency;
  onCreated: (goal: SavingsGoalVM) => void;
}) {
  const [name, setName] = React.useState("");
  const [target, setTarget] = React.useState("");
  const [initial, setInitial] = React.useState("");
  const [currency, setCurrency] = React.useState<Currency>(defaultCurrency);
  const [targetDate, setTargetDate] = React.useState("");
  const [color, setColor] = React.useState(GOAL_COLORS[0]!);
  const [roundUp, setRoundUp] = React.useState(true);
  const [recurring, setRecurring] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const currencies = Array.from(new Set(accounts.map((a) => a.currency)));

  React.useEffect(() => {
    if (open) {
      setName("");
      setTarget("");
      setInitial("");
      setCurrency(defaultCurrency);
      setTargetDate("");
      setColor(GOAL_COLORS[0]!);
      setRoundUp(true);
      setRecurring(false);
    }
  }, [open, defaultCurrency]);

  function submit() {
    if (name.trim().length === 0) {
      toast.error("Give your goal a name");
      return;
    }
    const targetMinor = decimalToMinor(target);
    if (targetMinor <= 0n) {
      toast.error("Enter a target amount greater than zero");
      return;
    }
    setSubmitting(true);
    // Sandbox: no /api/savings route. Create the vault optimistically.
    const goal: SavingsGoalVM = {
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `goal-${Date.now()}`,
      name: name.trim(),
      currency,
      targetAmount: targetMinor.toString(),
      currentAmount: decimalToMinor(initial).toString(),
      status: "ACTIVE",
      color,
      targetDate: targetDate ? new Date(targetDate).toISOString() : null,
      roundUp,
      recurring,
      recurringAmount: null,
    };
    onCreated(goal);
    toast("Sandbox", { description: `Goal "${goal.name}" created.` });
    setSubmitting(false);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a savings goal</DialogTitle>
          <DialogDescription>
            Name your vault, set a target, and choose how to auto-save. Sandbox — no real money
            moves.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="goal-name">Goal name</Label>
            <Input
              id="goal-name"
              value={name}
              maxLength={60}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Emergency fund"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="goal-target">Target amount</Label>
              <Input
                id="goal-target"
                inputMode="decimal"
                value={target}
                onChange={(e) => setTarget(e.target.value.replace(/[^\d.]/g, ""))}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(currencies.length > 0 ? currencies : [defaultCurrency]).map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="goal-initial">Starting deposit</Label>
              <Input
                id="goal-initial"
                inputMode="decimal"
                value={initial}
                onChange={(e) => setInitial(e.target.value.replace(/[^\d.]/g, ""))}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="goal-date">Target date</Label>
              <Input
                id="goal-date"
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {GOAL_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`h-7 w-7 rounded-full ring-offset-2 ring-offset-background transition-all ${
                    color === c ? "ring-2 ring-foreground" : ""
                  }`}
                  style={{ backgroundColor: c }}
                  aria-label={`Select color ${c}`}
                />
              ))}
            </div>
          </div>
          <div className="space-y-3 rounded-xl border border-border/60 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <Coins className="h-4 w-4 text-muted-foreground" /> Round-up auto-save
              </div>
              <Switch checked={roundUp} onCheckedChange={setRoundUp} aria-label="Round-up" />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <Repeat className="h-4 w-4 text-muted-foreground" /> Recurring auto-save
              </div>
              <Switch checked={recurring} onCheckedChange={setRecurring} aria-label="Recurring" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="gradient" onClick={submit} disabled={submitting}>
            {submitting ? "Creating…" : "Create goal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
