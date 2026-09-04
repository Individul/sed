"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, BellRing, BellOff } from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { ro } from "date-fns/locale";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";
import * as desktop from "@/lib/desktop-notifications";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/app/notifications/actions";
import { cn } from "@/lib/utils";
import type { Notification } from "@/lib/types";

function relativeTime(iso: string): string {
  return formatDistanceToNow(parseISO(iso), { addSuffix: true, locale: ro });
}

interface NotificationBellProps {
  initialItems: Notification[];
  initialUnread: number;
  userId: string;
}

export function NotificationBell({
  initialItems,
  initialUnread,
  userId,
}: NotificationBellProps) {
  const router = useRouter();
  const [items, setItems] = useState<Notification[]>(initialItems);
  const [unread, setUnread] = useState<number>(initialUnread);
  // Starea anunțurilor de sistem se citește abia după montare: pe server nu
  // există `Notification`, iar o valoare ghicită ar strica hidratarea.
  const [anunturi, setAnunturi] = useState<{
    supported: boolean;
    permission: NotificationPermission | null;
    enabled: boolean;
  }>({ supported: false, permission: null, enabled: false });

  useEffect(() => {
    setAnunturi({
      supported: desktop.isSupported(),
      permission: desktop.permission(),
      enabled: desktop.isEnabled(),
    });
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const n = payload.new as Notification;
          setItems((prev) => [n, ...prev].slice(0, 20));
          setUnread((u) => u + 1);
          // Anunțul de sistem se decide singur dacă apare: tace când
          // utilizatorul e chiar pe aplicație sau n-a cerut anunțuri.
          desktop.show(n, (href) => router.push(href));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, router]);

  const toggleAnunturi = async () => {
    if (anunturi.enabled) {
      desktop.setEnabled(false);
      setAnunturi((s) => ({ ...s, enabled: false }));
      return;
    }
    const p = await desktop.enable();
    setAnunturi((s) => ({ ...s, permission: p, enabled: p === "granted" }));
    if (p === "denied") {
      toast.error("Browserul a blocat anunțurile. Se reactivează din setările lui.");
    }
  };

  const handleItemClick = (n: Notification) => {
    if (n.read) return;
    setItems((prev) =>
      prev.map((it) => (it.id === n.id ? { ...it, read: true } : it)),
    );
    setUnread((u) => Math.max(0, u - 1));
    void markNotificationRead(n.id).then((res) => {
      if (res.error) toast.error(res.error);
    });
  };

  const handleMarkAll = async () => {
    const res = await markAllNotificationsRead();
    if (res.error) {
      toast.error(res.error);
      return;
    }
    setItems((prev) => prev.map((it) => ({ ...it, read: true })));
    setUnread(0);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium leading-none text-destructive-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
          <span className="sr-only">Notificări</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-96 w-80 overflow-y-auto">
        <div className="flex items-center justify-between gap-2 px-2 py-1.5">
          <div className="flex items-center gap-1">
            <span className="text-sm font-semibold">Notificări</span>
            {/* Doar iconiță: alături de „Marchează toate citite” nu încap două
                etichete în 320px. Înțelesul stă în `title` și în `aria-label`,
                iar starea în culoare — aprins când sunt pornite. */}
            {anunturi.supported && (
              <button
                type="button"
                onClick={() => void toggleAnunturi()}
                aria-pressed={anunturi.enabled}
                title={
                  anunturi.permission === "denied"
                    ? "Anunțurile pe ecran sunt blocate din setările browserului"
                    : anunturi.enabled
                      ? "Anunțuri pe ecran: pornite. Click pentru a le opri."
                      : "Anunțuri pe ecran: oprite. Click pentru a le porni."
                }
                aria-label={
                  anunturi.enabled
                    ? "Oprește anunțurile pe ecran"
                    : "Pornește anunțurile pe ecran"
                }
                className={cn(
                  "rounded p-1 transition-colors hover:bg-accent",
                  anunturi.enabled
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {anunturi.enabled ? (
                  <BellRing className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <BellOff className="h-3.5 w-3.5" aria-hidden />
                )}
              </button>
            )}
          </div>
          {unread > 0 && (
            <button
              type="button"
              onClick={() => void handleMarkAll()}
              className="shrink-0 text-xs font-normal text-muted-foreground transition-colors hover:text-foreground"
            >
              Marchează toate citite
            </button>
          )}
        </div>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">
            Nicio notificare.
          </p>
        ) : (
          <div className="space-y-0.5 py-1">
            {items.map((n) => {
              const content = (
                <div className="flex gap-2">
                  <span
                    aria-hidden
                    className={cn(
                      "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                      n.read ? "bg-transparent" : "bg-primary",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug">{n.message}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {n.actor_name ? `${n.actor_name} · ` : ""}
                      {relativeTime(n.created_at)}
                    </p>
                  </div>
                </div>
              );
              const base = cn(
                "block rounded-md px-2 py-2 text-left",
                !n.read && "bg-accent/60",
              );
              // Aceeași țintă ca a anunțului de sistem: dacă regula se schimbă,
              // se schimbă în amândouă odată.
              const href = desktop.notificationHref(n);
              return href ? (
                <Link
                  key={n.id}
                  href={href}
                  onClick={() => handleItemClick(n)}
                  className={cn(base, "transition-colors hover:bg-accent")}
                >
                  {content}
                </Link>
              ) : (
                <div key={n.id} className={base}>
                  {content}
                </div>
              );
            })}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
