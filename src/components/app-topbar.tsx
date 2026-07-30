"use client";

import { useState } from "react";
import Link from "next/link";
import { FlaskConical, LogOut, Settings } from "lucide-react";
import { Avatar } from "@/components/ui";
import { logoutAction } from "@/app/actions/auth";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { WorkspaceKindToggles } from "@/components/workspace-kind-toggles";
import { ThemeSwitcher } from "@/components/theme-switcher";
import type { UserPreferences } from "@/lib/user-preferences";
import type { LabBranding } from "@/lib/lab-branding-shared";
import { cn } from "@/lib/utils";

export function AppTopbar({
  branding,
  preferences,
  unreadNotifications = 0,
  user,
}: {
  branding: LabBranding;
  preferences: UserPreferences;
  unreadNotifications?: number;
  user: { name: string; role: string; profilesLabel?: string; avatarColor?: string };
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-3 sm:px-4">
      <Link href="/" className="flex min-w-0 items-center gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-brand text-brand-fg">
          {branding.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={branding.logoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <FlaskConical size={18} />
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight">{branding.name}</p>
          <p className="hidden text-[11px] text-muted sm:block">LabFlow</p>
        </div>
      </Link>

      <div className="mx-auto flex min-w-0 flex-1 justify-center">
        <WorkspaceKindToggles
          workspace={preferences.workspace ?? { mode: "all" }}
        />
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <ThemeSwitcher />
        <NotificationBell initialUnread={unreadNotifications} variant="icon" />

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className={cn(
              "flex items-center gap-2 rounded-lg p-1.5 transition hover:bg-surface2",
              menuOpen && "bg-surface2",
            )}
            title={user.name}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
          >
            <Avatar name={user.name} color={user.avatarColor} />
            <span className="hidden max-w-[9rem] truncate text-left text-sm font-medium md:block">
              {user.name}
            </span>
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div
                role="menu"
                className="absolute right-0 top-full z-50 mt-1 w-56 rounded-xl border border-border bg-surface py-1 shadow-xl"
              >
                <div className="border-b border-border px-3 py-2">
                  <p className="truncate text-sm font-medium">{user.name}</p>
                  <p className="text-[11px] text-muted line-clamp-2">
                    {user.profilesLabel ?? user.role}
                  </p>
                </div>
                <Link
                  href="/settings"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-muted transition hover:bg-surface2 hover:text-fg"
                >
                  <Settings size={15} /> Configuracoes
                </Link>
                <form action={logoutAction}>
                  <button
                    type="submit"
                    role="menuitem"
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-muted transition hover:bg-surface2 hover:text-fg"
                  >
                    <LogOut size={15} /> Sair
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
