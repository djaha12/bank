"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Search,
  Send,
  Plus,
  Repeat,
  CreditCard,
  Sparkles,
  SunMoon,
  CornerDownLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ADMIN_NAV, CUSTOMER_NAV } from "@/components/app/nav-config";

interface Cmd {
  id: string;
  label: string;
  group: string;
  icon: React.ComponentType<{ className?: string }>;
  run: () => void;
  keywords?: string;
}

export function CommandPalette({ kind }: { kind: "customer" | "admin" }) {
  const router = useRouter();
  const { setTheme, resolvedTheme } = useTheme();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);

  const commands = React.useMemo<Cmd[]>(() => {
    const nav = kind === "admin" ? ADMIN_NAV : CUSTOMER_NAV;
    const navCmds: Cmd[] = nav.map((n) => ({
      id: `nav:${n.href}`,
      label: n.label,
      group: "Navigate",
      icon: n.icon,
      run: () => router.push(n.href),
    }));
    const actions: Cmd[] =
      kind === "customer"
        ? [
            { id: "a:send", label: "Send money", group: "Actions", icon: Send, run: () => router.push("/transfers") },
            { id: "a:add", label: "Add money", group: "Actions", icon: Plus, run: () => router.push("/transfers?deposit=1") },
            { id: "a:fx", label: "Exchange currency", group: "Actions", icon: Repeat, run: () => router.push("/transfers?tab=fx") },
            { id: "a:card", label: "New virtual card", group: "Actions", icon: CreditCard, run: () => router.push("/cards?new=1") },
            { id: "a:ai", label: "Ask the AI assistant", group: "Actions", icon: Sparkles, run: () => router.push("/assistant") },
          ]
        : [];
    const theme: Cmd = {
      id: "t:theme",
      label: `Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`,
      group: "Preferences",
      icon: SunMoon,
      run: () => setTheme(resolvedTheme === "dark" ? "light" : "dark"),
    };
    return [...navCmds, ...actions, theme];
  }, [kind, router, resolvedTheme, setTheme]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => `${c.label} ${c.group} ${c.keywords ?? ""}`.toLowerCase().includes(q));
  }, [commands, query]);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  React.useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
    }
  }, [open]);

  React.useEffect(() => setActive(0), [query]);

  function runAt(i: number) {
    const cmd = filtered[i];
    if (!cmd) return;
    setOpen(false);
    cmd.run();
  }

  let lastGroup = "";

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="hidden items-center gap-2 rounded-lg border border-border/60 bg-background/50 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent sm:flex"
        aria-label="Open command palette"
      >
        <Search className="h-3.5 w-3.5" />
        <span>Search…</span>
        <kbd className="ml-2 rounded border border-border bg-muted px-1.5 text-[10px] font-medium">⌘K</kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="top-[20%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl">
          <div className="flex items-center gap-2 border-b border-border/60 px-4">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActive((a) => Math.min(a + 1, filtered.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((a) => Math.max(a - 1, 0));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  runAt(active);
                }
              }}
              placeholder="Type a command or search…"
              className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="max-h-80 overflow-y-auto scroll-thin p-2">
            {filtered.length === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-muted-foreground">No results</div>
            ) : (
              filtered.map((c, i) => {
                const showGroup = c.group !== lastGroup;
                lastGroup = c.group;
                const Icon = c.icon;
                return (
                  <React.Fragment key={c.id}>
                    {showGroup && (
                      <div className="px-2 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                        {c.group}
                      </div>
                    )}
                    <button
                      onMouseEnter={() => setActive(i)}
                      onClick={() => runAt(i)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors",
                        i === active ? "bg-primary/10 text-foreground" : "text-foreground/80 hover:bg-accent",
                      )}
                    >
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="flex-1 text-left">{c.label}</span>
                      {i === active && <CornerDownLeft className="h-3.5 w-3.5 text-muted-foreground" />}
                    </button>
                  </React.Fragment>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
