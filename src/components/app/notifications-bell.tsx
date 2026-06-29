"use client";

import * as React from "react";
import { Bell, ArrowLeftRight, ShieldCheck, CreditCard, FileCheck2, Sparkles, Info, CheckCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  TRANSACTION: ArrowLeftRight,
  SECURITY: ShieldCheck,
  CARD: CreditCard,
  KYC: FileCheck2,
  AI_INSIGHT: Sparkles,
  SYSTEM: Info,
};

export function NotificationsBell() {
  const [items, setItems] = React.useState<Notification[]>([]);
  const [unread, setUnread] = React.useState(0);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const data = await apiFetch<{ items: Notification[]; unreadCount: number }>("/api/notifications");
      setItems(data.items);
      setUnread(data.unreadCount);
    } catch {
      /* ignore */
    }
  }, []);

  React.useEffect(() => {
    void load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  async function markAll() {
    setLoading(true);
    try {
      await apiFetch("/api/notifications", { method: "PATCH", body: JSON.stringify({ all: true }) });
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnread(0);
    } finally {
      setLoading(false);
    }
  }

  return (
    <DropdownMenu onOpenChange={(o) => o && load()}>
      <DropdownMenuTrigger asChild>
        <button className="relative grid h-10 w-10 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute right-1.5 top-1.5 grid min-h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border/60 px-3 py-2.5">
          <span className="text-sm font-semibold">Notifications</span>
          {unread > 0 && (
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" disabled={loading} onClick={markAll}>
              <CheckCheck className="h-3.5 w-3.5" /> Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto scroll-thin">
          {items.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              You&apos;re all caught up.
            </div>
          ) : (
            <ul className="divide-y divide-border/50">
              {items.map((n) => {
                const Icon = ICONS[n.type] ?? Info;
                return (
                  <li key={n.id} className={cn("flex gap-3 px-3 py-3", !n.read && "bg-primary/[0.04]")}>
                    <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{n.title}</span>
                        {!n.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                      </div>
                      <p className="text-xs leading-snug text-muted-foreground">{n.body}</p>
                      <span className="mt-1 block text-[11px] text-muted-foreground/70">
                        {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
