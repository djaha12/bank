import { Sparkles } from "lucide-react";
import { requirePageUser } from "@/lib/page-auth";
import { CUSTOMER_DISCLAIMER } from "@/lib/ai/types";
import { AssistantClient } from "./AssistantClient";

export default async function AssistantPage() {
  const user = await requirePageUser();
  const firstName = user.firstName?.trim() || user.email.split("@")[0] || "there";

  return (
    <div className="flex h-[calc(100vh-9rem)] flex-col space-y-4">
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-glow">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">AI Assistant</h1>
            <p className="text-sm text-muted-foreground">
              Ask about your spending, savings, and account — grounded in your real sandbox data.
            </p>
          </div>
        </div>
        <p className="rounded-lg border border-warning/30 bg-warning/5 px-3 py-1.5 text-[11px] leading-snug text-muted-foreground">
          Not financial, legal, or tax advice. {CUSTOMER_DISCLAIMER}
        </p>
      </div>

      <AssistantClient greetingName={firstName} />
    </div>
  );
}
