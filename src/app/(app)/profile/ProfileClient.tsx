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
} from "lucide-react";
import { KycStatus } from "@prisma/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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

function kycBadge(status: KycStatus) {
  switch (status) {
    case KycStatus.APPROVED:
      return (
        <Badge variant="success">
          <CheckCircle2 className="mr-1 h-3 w-3" /> Verified
        </Badge>
      );
    case KycStatus.IN_REVIEW:
      return (
        <Badge variant="warning">
          <Search className="mr-1 h-3 w-3" /> In review
        </Badge>
      );
    case KycStatus.PENDING:
      return (
        <Badge variant="warning">
          <Clock className="mr-1 h-3 w-3" /> Pending
        </Badge>
      );
    case KycStatus.REJECTED:
      return (
        <Badge variant="destructive">
          <XCircle className="mr-1 h-3 w-3" /> Rejected
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary">
          <Clock className="mr-1 h-3 w-3" /> Not started
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
    <div className="space-y-6">
      {/* Identity hero */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 120, damping: 18 }}
      >
        <Card className="overflow-hidden">
          <div className="bg-brand-gradient h-20 w-full" />
          <CardContent className="-mt-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-end gap-4">
              <Avatar className="h-20 w-20 border-4 border-card shadow-card">
                <AvatarFallback className="text-xl">{initials.toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="pb-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-semibold">{fullName}</h2>
                  {kycBadge(profile.kycStatus)}
                </div>
                <p className="text-sm text-muted-foreground">
                  {revealSensitive ? profile.email : profile.emailMasked}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 pb-1">
              <Button variant="outline" size="sm" onClick={() => setRevealSensitive((v) => !v)}>
                {revealSensitive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                {revealSensitive ? "Hide details" : "Reveal details"}
              </Button>
              <Button variant="gradient" size="sm" onClick={() => setEditOpen(true)}>
                <Pencil className="h-4 w-4" /> Edit profile
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Personal data */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <IdCard className="h-5 w-5 text-muted-foreground" /> Personal information
            </CardTitle>
            <CardDescription>The details we hold for your identity record.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            <Field
              icon={<Mail className="h-4 w-4" />}
              label="Email"
              value={revealSensitive ? profile.email : profile.emailMasked}
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
          </CardContent>
        </Card>

        {/* Address + KYC */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="h-5 w-5 text-muted-foreground" /> Residential address
              </CardTitle>
              <CardDescription>Where you live. Used for compliance and statements.</CardDescription>
            </CardHeader>
            <CardContent>
              {addressLines.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No address on file yet. Complete identity verification to add one.
                </p>
              ) : (
                <address className="not-italic text-sm leading-relaxed">
                  {addressLines.map((line, i) => (
                    <div key={i} className={i === 0 ? "font-medium" : "text-muted-foreground"}>
                      {line}
                    </div>
                  ))}
                </address>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-5 w-5 text-muted-foreground" /> Identity verification
              </CardTitle>
              <CardDescription>Your KYC standing with the bank.</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-3">
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
                  <Button asChild variant="outline" size="sm">
                    <a href="/kyc">Go to verification</a>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Privacy & consent */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="h-5 w-5 text-muted-foreground" /> Privacy &amp; consent
          </CardTitle>
          <CardDescription>
            Decide how we use your data. Changes apply instantly (sandbox — stored locally).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ConsentRow
            icon={<Bell className="h-4 w-4 text-muted-foreground" />}
            title="Transaction alerts"
            description="Get notified the moment money moves on your account."
            checked={consent.transactionAlerts}
            onChange={(v) => setConsentValue("transactionAlerts", v)}
          />
          <ConsentRow
            icon={<BarChart3 className="h-4 w-4 text-muted-foreground" />}
            title="Product analytics"
            description="Help us improve by sharing anonymous usage data."
            checked={consent.productAnalytics}
            onChange={(v) => setConsentValue("productAnalytics", v)}
          />
          <ConsentRow
            icon={<Megaphone className="h-4 w-4 text-muted-foreground" />}
            title="Marketing communications"
            description="Receive offers and product news. Off by default."
            checked={consent.marketing}
            onChange={(v) => setConsentValue("marketing", v)}
          />
          <ConsentRow
            icon={<Database className="h-4 w-4 text-muted-foreground" />}
            title="Third-party data sharing"
            description="Allow trusted partners to access limited, aggregated data."
            checked={consent.dataSharing}
            onChange={(v) => setConsentValue("dataSharing", v)}
          />
        </CardContent>
      </Card>

      <EditProfileDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        profile={profile}
        onSaved={(next) => setProfile(next)}
      />
    </div>
  );
}

function Field({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/40 py-3 last:border-0">
      <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
        <span className="text-muted-foreground/80">{icon}</span>
        {label}
      </div>
      <span className="text-right text-sm font-medium">{value ?? "Not provided"}</span>
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
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border/60 p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-muted p-2">{icon}</div>
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
          <DialogTitle>Edit profile</DialogTitle>
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
