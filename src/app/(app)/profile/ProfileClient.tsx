"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Pencil,
  Eye,
  EyeOff,
  MapPin,
  IdCard,
  Mail,
  Phone,
  Briefcase,
  Globe,
  Calendar,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Search,
  XCircle,
  Bell,
  BarChart3,
  Megaphone,
  Database,
  Wallet,
  ArrowRight,
} from "lucide-react";
import { KycStatus } from "@prisma/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

export interface ProfileVM {
  firstName: string;
  lastName: string;
  email: string;
  emailMasked: string;
  phone: string | null;
  phoneMasked: string | null;
  dateOfBirth: string | null;
  nationality: string | null;
  country: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  postalCode: string | null;
  occupation: string | null;
  sourceOfFunds: string | null;
  kycStatus: KycStatus;
}

const SOURCE_LABELS: Record<string, string> = {
  SALARY: "Salary / employment",
  BUSINESS: "Business income",
  INVESTMENTS: "Investments",
  SAVINGS: "Savings",
  OTHER: "Other",
};

type Accent = "violet" | "cyan" | "emerald" | "blue";

const ACCENT_CHIP: Record<Accent, string> = {
  violet: "from-brand-violet/30 to-brand-violet/5 text-brand-violet",
  cyan: "from-brand-cyan/30 to-brand-cyan/5 text-brand-cyan",
  emerald: "from-brand-emerald/30 to-brand-emerald/5 text-brand-emerald",
  blue: "from-brand-blue/30 to-brand-blue/5 text-brand-blue",
};

function kycBadge(status: KycStatus) {
  switch (status) {
    case KycStatus.APPROVED:
      return (
        <Badge variant="success" className="gap-1">
          <CheckCircle2 className="h-3 w-3" /> Verified
        </Badge>
      );
    case KycStatus.IN_REVIEW:
      return (
        <Badge variant="warning" className="gap-1">
          <Search className="h-3 w-3" /> In review
        </Badge>
      );
    case KycStatus.PENDING:
      return (
        <Badge variant="warning" className="gap-1">
          <Clock className="h-3 w-3" /> Pending
        </Badge>
      );
    case KycStatus.REJECTED:
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" /> Rejected
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary" className="gap-1">
          <Clock className="h-3 w-3" /> Not started
        </Badge>
      );
  }
}

export function ProfileClient({ initial }: { initial: ProfileVM }) {
  const [profile, setProfile] = React.useState<ProfileVM>(initial);
  const [editOpen, setEditOpen] = React.useState(false);
  const [revealSensitive, setRevealSensitive] = React.useState(false);

  // Consent / privacy toggles — sandbox optimistic, persisted only in memory.
  const [consent, setConsent] = React.useState({
    transactionAlerts: true,
    productAnalytics: true,
    marketing: false,
    dataSharing: false,
  });

  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(" ") || "Your name";
  const initials =
    (profile.firstName?.[0] ?? "") + (profile.lastName?.[0] ?? "") || profile.email[0]?.toUpperCase() || "U";

  const addressLines = [
    profile.addressLine1,
    profile.addressLine2,
    [profile.city, profile.postalCode].filter(Boolean).join(" "),
    profile.country,
  ].filter((l): l is string => Boolean(l && l.trim()));

  function setConsentValue(key: keyof typeof consent, value: boolean) {
    setConsent((prev) => ({ ...prev, [key]: value }));
    toast.success("Preference saved", { description: "Your privacy choice has been updated." });
  }

  return (
    <div className="space-y-8">
      {/* Identity hero — premium-surface, masked-aware */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 120, damping: 18 }}
        className="premium-surface ring-glow shine relative overflow-hidden p-6 text-white sm:p-8"
      >
        <div className="bg-grid pointer-events-none absolute inset-0 opacity-20" />
        <div className="relative z-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-5">
            <div className="relative grid h-20 w-20 shrink-0 place-items-center rounded-2xl border border-white/15 bg-white/10 font-display text-2xl font-semibold shadow-glow backdrop-blur-sm sm:h-24 sm:w-24 sm:text-3xl">
              {initials.toUpperCase()}
              <span className="absolute -bottom-1.5 -right-1.5 grid h-7 w-7 place-items-center rounded-full border-2 border-[hsl(222_47%_9%)] bg-brand-gradient text-white shadow-glow">
                <ShieldCheck className="h-3.5 w-3.5" />
              </span>
            </div>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{fullName}</h2>
                {kycBadge(profile.kycStatus)}
              </div>
              <p className="font-mono text-sm text-white/70">
                {revealSensitive ? profile.email : profile.emailMasked}
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-0.5 text-xs text-white/55">
                {profile.country && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/10 px-2.5 py-0.5 backdrop-blur">
                    <Globe className="h-3 w-3" /> {profile.country}
                  </span>
                )}
                {profile.occupation && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/10 px-2.5 py-0.5 backdrop-blur">
                    <Briefcase className="h-3 w-3" /> {profile.occupation}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-white/20 bg-white/5 text-white hover:bg-white/15"
              onClick={() => setRevealSensitive((v) => !v)}
            >
              {revealSensitive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {revealSensitive ? "Hide details" : "Reveal details"}
            </Button>
            <Button variant="gradient" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" /> Edit profile
            </Button>
          </div>
        </div>
      </motion.section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Personal data */}
        <PanelCard
          icon={<IdCard className="h-4 w-4" />}
          accent="violet"
          title="Personal information"
          description="The details we hold for your identity record."
          index={0}
        >
          <div className="space-y-1">
            <Field
              icon={<Mail className="h-4 w-4" />}
              label="Email"
              value={revealSensitive ? profile.email : profile.emailMasked}
              mono
            />
            <Field
              icon={<Phone className="h-4 w-4" />}
              label="Phone"
              value={
                profile.phone
                  ? revealSensitive
                    ? profile.phone
                    : profile.phoneMasked
                  : "Not provided"
              }
              mono={!!profile.phone}
            />
            <Field
              icon={<Calendar className="h-4 w-4" />}
              label="Date of birth"
              value={
                profile.dateOfBirth
                  ? revealSensitive
                    ? profile.dateOfBirth
                    : "••••-••-••"
                  : "Not provided"
              }
              mono={!!profile.dateOfBirth}
            />
            <Field
              icon={<Globe className="h-4 w-4" />}
              label="Nationality"
              value={profile.nationality ?? "Not provided"}
            />
            <Field
              icon={<Briefcase className="h-4 w-4" />}
              label="Occupation"
              value={profile.occupation ?? "Not provided"}
            />
            <Field
              icon={<Wallet className="h-4 w-4" />}
              label="Source of funds"
              value={
                profile.sourceOfFunds
                  ? SOURCE_LABELS[profile.sourceOfFunds] ?? profile.sourceOfFunds
                  : "Not provided"
              }
            />
          </div>
        </PanelCard>

        {/* Address + KYC */}
        <div className="space-y-6">
          <PanelCard
            icon={<MapPin className="h-4 w-4" />}
            accent="cyan"
            title="Residential address"
            description="Where you live. Used for compliance and statements."
            index={1}
          >
            {addressLines.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/70 px-4 py-6 text-center text-sm text-muted-foreground">
                No address on file yet. Complete identity verification to add one.
              </div>
            ) : (
              <address className="not-italic text-sm leading-relaxed">
                {addressLines.map((line, i) => (
                  <div key={i} className={i === 0 ? "font-medium" : "text-muted-foreground"}>
                    {line}
                  </div>
                ))}
              </address>
            )}
          </PanelCard>

          <PanelCard
            icon={<ShieldCheck className="h-4 w-4" />}
            accent="emerald"
            title="Identity verification"
            description="Your KYC standing with the bank."
            index={2}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="text-sm font-medium">Current status</div>
                <p className="text-xs text-muted-foreground">
                  {profile.kycStatus === KycStatus.APPROVED
                    ? "You're fully verified and can move money."
                    : "Verification unlocks transfers, cards and higher limits."}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                {kycBadge(profile.kycStatus)}
                {profile.kycStatus !== KycStatus.APPROVED && (
                  <Button asChild variant="gradient" size="sm">
                    <a href="/kyc">
                      Verify <ArrowRight className="h-4 w-4" />
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </PanelCard>
        </div>
      </div>

      {/* Privacy & consent */}
      <PanelCard
        icon={<Database className="h-4 w-4" />}
        accent="blue"
        title="Privacy & consent"
        description="Decide how we use your data. Changes apply instantly (sandbox — stored locally)."
        index={3}
      >
        <div className="space-y-3">
          <ConsentRow
            icon={<Bell className="h-4 w-4" />}
            title="Transaction alerts"
            description="Get notified the moment money moves on your account."
            checked={consent.transactionAlerts}
            onChange={(v) => setConsentValue("transactionAlerts", v)}
          />
          <ConsentRow
            icon={<BarChart3 className="h-4 w-4" />}
            title="Product analytics"
            description="Help us improve by sharing anonymous usage data."
            checked={consent.productAnalytics}
            onChange={(v) => setConsentValue("productAnalytics", v)}
          />
          <ConsentRow
            icon={<Megaphone className="h-4 w-4" />}
            title="Marketing communications"
            description="Receive offers and product news. Off by default."
            checked={consent.marketing}
            onChange={(v) => setConsentValue("marketing", v)}
          />
          <ConsentRow
            icon={<Database className="h-4 w-4" />}
            title="Third-party data sharing"
            description="Allow trusted partners to access limited, aggregated data."
            checked={consent.dataSharing}
            onChange={(v) => setConsentValue("dataSharing", v)}
          />
        </div>
      </PanelCard>

      <EditProfileDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        profile={profile}
        onSaved={(next) => setProfile(next)}
      />
    </div>
  );
}

function PanelCard({
  icon,
  accent,
  title,
  description,
  index,
  children,
}: {
  icon: React.ReactNode;
  accent: Accent;
  title: string;
  description: string;
  index: number;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
      className="glass-card ring-glow lift relative overflow-hidden rounded-3xl p-6"
    >
      <div className="mb-5 flex items-start gap-3">
        <span
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br ring-1 ring-white/10 ${ACCENT_CHIP[accent]}`}
        >
          {icon}
        </span>
        <div>
          <h2 className="font-display text-base font-semibold tracking-tight">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </motion.div>
  );
}

function Field({
  icon,
  label,
  value,
  mono = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
  mono?: boolean;
}) {
  return (
    <div className="-mx-2 flex items-center justify-between gap-3 rounded-xl border-b border-border/40 px-2 py-3 transition-colors last:border-0 hover:bg-muted/40">
      <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
        <span className="text-muted-foreground/70">{icon}</span>
        {label}
      </div>
      <span className={`text-right text-sm font-medium ${mono ? "font-mono tabular-nums" : ""}`}>
        {value ?? "Not provided"}
      </span>
    </div>
  );
}

function ConsentRow({
  icon,
  title,
  description,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 rounded-2xl border p-4 transition-colors ${
        checked ? "border-primary/30 bg-primary/[0.04]" : "border-border/60"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ring-1 transition-colors ${
            checked
              ? "bg-primary/15 text-primary ring-primary/20"
              : "bg-muted text-muted-foreground ring-white/5"
          }`}
        >
          {icon}
        </div>
        <div>
          <div className="text-sm font-medium">{title}</div>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={title} />
    </div>
  );
}

// --- Edit dialog (sandbox optimistic — local only) --------------------------

function EditProfileDialog({
  open,
  onOpenChange,
  profile,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  profile: ProfileVM;
  onSaved: (next: ProfileVM) => void;
}) {
  const [form, setForm] = React.useState({
    firstName: profile.firstName,
    lastName: profile.lastName,
    phone: profile.phone ?? "",
    occupation: profile.occupation ?? "",
    addressLine1: profile.addressLine1 ?? "",
    addressLine2: profile.addressLine2 ?? "",
    city: profile.city ?? "",
    postalCode: profile.postalCode ?? "",
  });
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setForm({
        firstName: profile.firstName,
        lastName: profile.lastName,
        phone: profile.phone ?? "",
        occupation: profile.occupation ?? "",
        addressLine1: profile.addressLine1 ?? "",
        addressLine2: profile.addressLine2 ?? "",
        city: profile.city ?? "",
        postalCode: profile.postalCode ?? "",
      });
    }
  }, [open, profile]);

  function maskPhone(phone: string): string | null {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 4) return digits ? "••" : null;
    return `${"•".repeat(Math.max(2, digits.length - 2))}${digits.slice(-2)}`;
  }

  async function save() {
    if (form.firstName.trim().length === 0 || form.lastName.trim().length === 0) {
      toast.error("First and last name are required");
      return;
    }
    setSaving(true);
    // Sandbox-optimistic: no profile mutation route in this assignment.
    await new Promise((r) => setTimeout(r, 400));
    const phone = form.phone.trim() || null;
    onSaved({
      ...profile,
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      phone,
      phoneMasked: phone ? maskPhone(phone) : null,
      occupation: form.occupation.trim() || null,
      addressLine1: form.addressLine1.trim() || null,
      addressLine2: form.addressLine2.trim() || null,
      city: form.city.trim() || null,
      postalCode: form.postalCode.trim() || null,
    });
    setSaving(false);
    toast.success("Profile updated");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display tracking-tight">Edit profile</DialogTitle>
          <DialogDescription>
            Update your contact details and address. Changes are sandbox-only.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName">First name</Label>
              <Input
                id="firstName"
                value={form.firstName}
                maxLength={80}
                onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last name</Label>
              <Input
                id="lastName"
                value={form.lastName}
                maxLength={80}
                onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={form.phone}
                maxLength={32}
                placeholder="+996 ..."
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="occupation">Occupation</Label>
              <Input
                id="occupation"
                value={form.occupation}
                maxLength={120}
                onChange={(e) => setForm((f) => ({ ...f, occupation: e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="addr1">Address line 1</Label>
            <Input
              id="addr1"
              value={form.addressLine1}
              maxLength={200}
              onChange={(e) => setForm((f) => ({ ...f, addressLine1: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="addr2">Address line 2</Label>
            <Input
              id="addr2"
              value={form.addressLine2}
              maxLength={200}
              onChange={(e) => setForm((f) => ({ ...f, addressLine2: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={form.city}
                maxLength={120}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="postal">Postal code</Label>
              <Input
                id="postal"
                value={form.postalCode}
                maxLength={20}
                onChange={(e) => setForm((f) => ({ ...f, postalCode: e.target.value }))}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button variant="gradient" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
