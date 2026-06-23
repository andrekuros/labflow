"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Puzzle,
  Settings,
  FlaskConical,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui";
import { logoutAction } from "@/app/actions/auth";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { ThemePicker } from "@/components/theme-picker";
import { getNavIcon } from "@/plugins/nav-icons";
import type { NavItem } from "@/plugins/types";

type SidebarProps = {
  user: { name: string; role: string; avatarColor?: string };
  navItems: NavItem[];
  unreadNotifications?: number;
};

function groupItems(items: NavItem[]) {
  const groups = new Map<string, NavItem[]>();
  for (const item of items) {
    const list = groups.get(item.group) ?? [];
    list.push(item);
    groups.set(item.group, list);
  }
  return [...groups.entries()];
}

export function Sidebar({ user, navItems, unreadNotifications = 0 }: SidebarProps) {
  const pathname = usePathname();
  const isAdmin = user.role === "admin";
  const grouped = groupItems(navItems);

  const coreItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    ...(isAdmin ? [{ href: "/settings", label: "Configuracoes", icon: Settings }] : []),
    { href: "/plugins", label: "Plugins", icon: Puzzle },
  ];

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-border bg-surface">
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-brand-fg">
          <FlaskConical size={18} />
        </div>
        <div>
          <p className="text-sm font-semibold leading-tight">LabFlow</p>
          <p className="text-[11px] text-muted">Pesquisa</p>
        </div>
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto px-2 py-2">
        <div>
          <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted">Principal</p>
          <div className="space-y-0.5">
            {coreItems.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition",
                    active ? "bg-brand/15 font-medium text-fg" : "text-muted hover:bg-surface2 hover:text-fg",
                  )}
                >
                  <Icon size={17} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>

        {grouped.map(([group, items]) => (
          <div key={group}>
            <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted">{group}</p>
            <div className="space-y-0.5">
              {items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = getNavIcon(item.icon);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition",
                      active ? "bg-brand/15 font-medium text-fg" : "text-muted hover:bg-surface2 hover:text-fg",
                    )}
                  >
                    <Icon size={17} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <ThemePicker />

      <NotificationBell initialUnread={unreadNotifications} />

      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2">
          <Avatar name={user.name} color={user.avatarColor} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="text-[11px] capitalize text-muted">{user.role}</p>
          </div>
          <form action={logoutAction}>
            <button
              className="rounded-lg p-2 text-muted transition hover:bg-surface2 hover:text-fg"
              title="Sair"
              type="submit"
            >
              <LogOut size={16} />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
