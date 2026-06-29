"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  PiggyBank,
  Receipt,
  SendHorizonal,
  ShieldAlert,
  Sparkles,
  Target,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/client";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  pending?: boolean;
}

interface ChatResponse {
  conversationId: string;
  skill: string;
  content: string;
  grounding: Record<string, unknown>;
}

const SUGGESTIONS: { label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { label: "Explain my spending", icon: Receipt },
  { label: "How can I save more?", icon: PiggyBank },
  { label: "Detect unusual transaction", icon: ShieldAlert },
  { label: "Create a monthly budget", icon: Target },
];

function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `m-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function AssistantClient({ greetingName }: { greetingName: string }) {
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [conversationId, setConversationId] = React.useState<string | undefined>(undefined);
  const [sending, setSending] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const hasStarted = messages.length > 0;

  React.useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    const userMsg: ChatMessage = { id: uid(), role: "user", content: trimmed };
    const pendingId = uid();
    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: pendingId, role: "assistant", content: "", pending: true },
    ]);
    setInput("");
    setSending(true);

    try {
      const res = await apiFetch<ChatResponse>("/api/ai/chat", {
        method: "POST",
        body: JSON.stringify({ message: trimmed, conversationId }),
      });
      // Auto-created on first message; remember it for the rest of the thread.
      setConversationId(res.conversationId);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingId ? { ...m, content: res.content, pending: false } : m,
        ),
      );
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== pendingId));
      toast.error(err instanceof Error ? err.message : "The assistant is unavailable right now");
    } finally {
      setSending(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    void send(input);
  }

  return (
    <Card className="glass-card relative flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Messages */}
      <ScrollArea className="flex-1">
        <div ref={scrollRef} className="h-full">
          <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4 sm:p-6">
            {!hasStarted ? (
              <Welcome name={greetingName} onPick={(q) => void send(q)} />
            ) : (
              <AnimatePresence initial={false}>
                {messages.map((m) => (
                  <MessageBubble key={m.id} message={m} />
                ))}
              </AnimatePresence>
            )}
          </div>
        </div>
      </ScrollArea>

      {/* Quick chips (when conversation has started) */}
      {hasStarted && (
        <div className="border-t border-border/60 px-4 py-2 sm:px-6">
          <div className="mx-auto flex max-w-3xl flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s.label}
                type="button"
                disabled={sending}
                onClick={() => void send(s.label)}
                className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/50 px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-50"
              >
                <s.icon className="h-3 w-3" />
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Composer */}
      <form
        onSubmit={onSubmit}
        className="border-t border-border/60 bg-background/40 p-4 backdrop-blur sm:p-6"
      >
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your money…"
            maxLength={2000}
            disabled={sending}
            aria-label="Message the assistant"
            className="h-11 rounded-xl"
          />
          <Button
            type="submit"
            variant="gradient"
            size="icon"
            className="h-11 w-11 rounded-xl"
            disabled={sending || input.trim().length === 0}
            aria-label="Send"
          >
            <SendHorizonal className="h-4 w-4" />
          </Button>
        </div>
        <p className="mx-auto mt-2 max-w-3xl text-center text-[11px] text-muted-foreground">
          Not financial, legal, or tax advice. Responses are generated in this sandbox.
        </p>
      </form>
    </Card>
  );
}

// --- Welcome / empty state ----------------------------------------------------

function Welcome({ name, onPick }: { name: string; onPick: (q: string) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center gap-6 py-10 text-center"
    >
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-glow">
        <Sparkles className="h-7 w-7" />
      </span>
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">Hi {name}, how can I help?</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          I can explain where your money goes, suggest ways to save, flag unusual activity, and help
          you set a budget — all grounded in your sandbox data.
        </p>
      </div>
      <div className="grid w-full max-w-xl gap-3 sm:grid-cols-2">
        {SUGGESTIONS.map((s, i) => (
          <motion.button
            key={s.label}
            type="button"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i }}
            onClick={() => onPick(s.label)}
            className="group flex items-center gap-3 rounded-xl border border-border/70 bg-background/50 p-4 text-left transition-all hover:border-primary/40 hover:shadow-glow"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary transition-colors group-hover:bg-primary/25">
              <s.icon className="h-4 w-4" />
            </span>
            <span className="text-sm font-medium">{s.label}</span>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}

// --- Message bubble -----------------------------------------------------------

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 22 }}
      className={cn("flex items-end gap-2.5", isUser ? "flex-row-reverse" : "flex-row")}
    >
      {!isUser && (
        <Avatar className="h-8 w-8 shadow-glow">
          <AvatarFallback>
            <Sparkles className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
      )}
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
          isUser
            ? "rounded-br-sm bg-primary text-primary-foreground"
            : "rounded-bl-sm border border-border/60 bg-card text-foreground",
        )}
      >
        {message.pending ? <TypingDots /> : <p className="whitespace-pre-wrap">{message.content}</p>}
      </div>
    </motion.div>
  );
}

function TypingDots() {
  return (
    <span className="flex items-center gap-1 py-1" aria-label="Assistant is typing">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-muted-foreground"
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </span>
  );
}
