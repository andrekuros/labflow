"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Bell, Check } from "lucide-react";
import {
  getNotificationsAction,
  markNotificationReadAction,
  markAllNotificationsReadAction,
} from "@/app/actions/notifications";

export function NotificationBell({ initialUnread }: { initialUnread: number }) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(initialUnread);
  const [items, setItems] = useState<
    { id: string; kind: string; title: string; message: string; href: string | null; read: boolean; createdAt: string }[]
  >([]);
  const [pending, start] = useTransition();

  function load() {
    start(async () => {
      const rows = await getNotificationsAction();
      setItems(rows);
      setUnread(rows.filter((r) => !r.read).length);
    });
  }

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div className="relative px-2 pb-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-muted transition hover:bg-surface2 hover:text-fg"
      >
        <Bell size={17} />
        <span>Notificacoes</span>
        {unread > 0 && (
          <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-medium text-brand-fg">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-2 right-2 z-50 mb-1 max-h-80 overflow-y-auto rounded-xl border border-border bg-surface shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <p className="text-xs font-semibold">Notificacoes</p>
              {unread > 0 && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => start(async () => { await markAllNotificationsReadAction(); load(); })}
                  className="flex items-center gap-1 text-[11px] text-brand hover:underline"
                >
                  <Check size={12} /> Marcar todas
                </button>
              )}
            </div>
            {items.length === 0 && <p className="px-3 py-4 text-xs text-muted">Nenhuma notificacao.</p>}
            {items.map((n) => (
              <div
                key={n.id}
                className={`border-b border-border/60 px-3 py-2 last:border-0 ${n.read ? "opacity-70" : ""}`}
              >
                {n.href ? (
                  <Link
                    href={n.href}
                    onClick={() => {
                      if (!n.read) start(async () => { await markNotificationReadAction(n.id); setUnread((u) => Math.max(0, u - 1)); });
                      setOpen(false);
                    }}
                    className="block"
                  >
                    <p className="text-xs font-medium">{n.title}</p>
                    {n.message && <p className="mt-0.5 text-[11px] text-muted">{n.message}</p>}
                  </Link>
                ) : (
                  <div>
                    <p className="text-xs font-medium">{n.title}</p>
                    {n.message && <p className="mt-0.5 text-[11px] text-muted">{n.message}</p>}
                  </div>
                )}
                <p className="mt-1 text-[10px] text-muted">
                  {new Date(n.createdAt).toLocaleString("pt-BR")}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
