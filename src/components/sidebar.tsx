"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getNavIcon } from "@/plugins/nav-icons";
import { setSidebarCollapsed } from "@/app/actions/preferences";
import type { NavItem } from "@/plugins/types";
import type { UserPreferences } from "@/lib/user-preferences";
import { useTransition } from "react";
import { useRouter } from "next/navigation";

type SidebarProps = {
  navItems: NavItem[];
  preferences: UserPreferences;
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

export function Sidebar({ navItems, preferences }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const collapsed = Boolean(preferences.sidebarCollapsed);
  const hidden = new Set(preferences.navHidden ?? []);
  const [pending, start] = useTransition();

  const visibleNav = navItems.filter((item) => !hidden.has(item.pluginId));
  const grouped = groupItems(visibleNav);
  const showDashboard = !hidden.has("__dashboard");

  const toggleCollapse = () => {
    start(async () => {
      await setSidebarCollapsed(!collapsed);
      router.refresh();
    });
  };

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col border-r border-border bg-surface transition-[width] duration-200",
        collapsed ? "w-16" : "w-60",
      )}
    >
      <nav className="flex-1 space-y-4 overflow-y-auto px-2 py-3">
        {showDashboard && (
          <div>
            {!collapsed && (
              <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted">Principal</p>
            )}
            <div className="space-y-0.5">
              <Link
                href="/"
                title="Dashboard"
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition",
                  pathname === "/"
                    ? "bg-brand/15 font-medium text-fg"
                    : "text-muted hover:bg-surface2 hover:text-fg",
                  collapsed && "justify-center px-2",
                )}
              >
                <LayoutDashboard size={17} />
                {!collapsed && "Dashboard"}
              </Link>
            </div>
          </div>
        )}

        {grouped.map(([group, items]) => (
          <div key={group}>
            {!collapsed && (
              <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted">{group}</p>
            )}
            <div className="space-y-0.5">
              {items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = getNavIcon(item.icon);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.label}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition",
                      active ? "bg-brand/15 font-medium text-fg" : "text-muted hover:bg-surface2 hover:text-fg",
                      collapsed && "justify-center px-2",
                    )}
                  >
                    <Icon size={17} />
                    {!collapsed && item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-border px-2 py-2">
        <button
          type="button"
          disabled={pending}
          onClick={toggleCollapse}
          className={cn(
            "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-muted transition hover:bg-surface2 hover:text-fg",
            collapsed && "justify-center px-2",
          )}
          title={collapsed ? "Expandir menu" : "Recolher menu"}
        >
          {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          {!collapsed && "Recolher menu"}
        </button>
      </div>
    </aside>
  );
}
