import { Sparkles, ShieldAlert } from "lucide-react";
import { requirePageUser } from "@/lib/page-auth";
import { CUSTOMER_DISCLAIMER } from "@/lib/ai/types";
import { AssistantClient } from "./AssistantClient";

export default async function AssistantPage() {
  const user = await requirePageUser();
  const firstName = user.firstName?.trim() || user.email.split("@")[0] || "there";

  return (
    <div className="flex h-[calc(100vh-9rem)] flex-col space-y-4">
      <div className="space-y-3">
        <div className="flex items-center gap-3.5">
          <span className="animate-glow-pulse relative flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-glow">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
              AI <span className="text-gradient">Assistant</span>
            </h1>
            <p className="text-sm text-muted-foreground">
              Ask about your spending, savings, and account — grounded in your real sandbox data.
            </p>
          </div>
        </div>
        <p className="flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/5 px-3 py-1.5 text-[11px] leading-snug text-muted-foreground">
          <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-warning" />
          <span>
            Not financial, legal, or tax advice. {CUSTOMER_DISCLAIMER}
          </span>
        </p>
      </div>

      <AssistantClient greetingName={firstName} />
    </div>
  );
}
