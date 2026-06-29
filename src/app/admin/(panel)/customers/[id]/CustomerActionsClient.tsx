"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Ban, ShieldOff, ShieldCheck, Loader2, FileLock2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Action = "BLOCK" | "UNBLOCK" | "SUSPEND";

const ACTION_META: Record<
  Action,
  { title: string; verb: string; danger: boolean; description: string }
> = {
  BLOCK: {
    title: "Block customer",
    verb: "Block",
    danger: true,
    description: "Blocks all account access and money movement immediately.",
  },
  SUSPEND: {
    title: "Suspend customer",
    verb: "Suspend",
    danger: true,
    description: "Temporarily suspends the account pending review.",
  },
  UNBLOCK: {
    title: "Reactivate customer",
    verb: "Reactivate",
    danger: false,
    description: "Restores full account access for this customer.",
  },
};

export function CustomerActionsClient({
  customerId,
  customerName,
  status,
}: {
  customerId: string;
  customerName: string;
  status: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [action, setAction] = React.useState<Action>("BLOCK");
  const [reason, setReason] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const isActive = status === "ACTIVE";

  function start(a: Action) {
    setAction(a);
    setReason("");
    setOpen(true);
  }

  async function submit() {
    if (!reason.trim()) {
      toast.error("A reason is required and will be recorded in the audit log.");
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch(`/api/admin/customers/${customerId}`, {
        method: "PATCH",
        body: JSON.stringify({ action, reason: reason.trim() }),
      });
      toast.success(`${ACTION_META[action].verb} applied to ${customerName}.`);
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setSubmitting(false);
    }
  }

  const meta = ACTION_META[action];

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {isActive ? (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => start("SUSPEND")}
              className="border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"
            >
              <ShieldOff className="h-4 w-4" /> Suspend
            </Button>
            <Button variant="destructive" size="sm" onClick={() => start("BLOCK")}>
              <Ban className="h-4 w-4" /> Block
            </Button>
          </>
        ) : (
          <>
            <Button variant="gradient" size="sm" onClick={() => start("UNBLOCK")}>
              <ShieldCheck className="h-4 w-4" /> Reactivate
            </Button>
            {status !== "BLOCKED" && (
              <Button variant="destructive" size="sm" onClick={() => start("BLOCK")}>
                <Ban className="h-4 w-4" /> Block
              </Button>
            )}
          </>
        )}
      </div>

      <Dialog open={open} onOpenChange={(o) => !submitting && setOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{meta.title}</DialogTitle>
            <DialogDescription>{meta.description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reason">Reason</Label>
            <Input
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Suspected account takeover — case #1234"
              maxLength={500}
              autoFocus
            />
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <FileLock2 className="h-3.5 w-3.5" />
              This action is recorded in the tamper-evident audit log and the customer is notified.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              variant={meta.danger ? "destructive" : "gradient"}
              onClick={submit}
              disabled={submitting || !reason.trim()}
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {meta.verb}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
