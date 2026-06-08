"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  KanbanSquare,
  FolderKanban,
  Timer,
  Map,
  PackageCheck,
  Target,
  BookOpen,
  MessagesSquare,
  Bot,
  Puzzle,
  Users,
  FlaskConical,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui";
import { logoutAction } from "@/app/actions/auth";
import { ThemePicker } from "@/components/theme-picker";

const groups: {
  label: string;
  items: { href: string; label: string; icon: React.ComponentType<{ size?: number }> }[];
}[] = [
  {
    label: "Trabalho",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/board", label: "Kanban", icon: KanbanSquare },
      { href: "/projects", label: "Projetos", icon: FolderKanban },
      { href: "/sprints", label: "Sprints", icon: Timer },
    ],
  },
  {
    label: "Planejamento",
    items: [
      { href: "/roadmap", label: "Roadmap", icon: Map },
      { href: "/deliverables", label: "Entregaveis", icon: PackageCheck },
      { href: "/requirements", label: "Requisitos", icon: Target },
    ],
  },
  {
    label: "Conhecimento",
    items: [
      { href: "/knowledge", label: "Conhecimento", icon: BookOpen },
      { href: "/forum", label: "Foruns", icon: MessagesSquare },
      { href: "/assistant", label: "Assistente IA", icon: Bot },
    ],
  },
  {
    label: "Administracao",
    items: [
      { href: "/plugins", label: "Plugins", icon: Puzzle },
      { href: "/team", label: "Equipe", icon: Users },
    ],
  },
];

export function Sidebar({ user }: { user: { name: string; role: string; avatarColor?: string } }) {
  const pathname = usePathname();

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
        {groups.map((group) => (
          <div key={group.label}>
            <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active =
                  item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition",
                      active
                        ? "bg-brand/15 font-medium text-fg"
                        : "text-muted hover:bg-surface2 hover:text-fg",
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
