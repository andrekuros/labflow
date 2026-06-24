"use client";

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
  Settings,
  FlaskConical,
  Cpu,
  ShieldCheck,
  GraduationCap,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
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
  Settings,
  FlaskConical,
  Cpu,
  ShieldCheck,
  GraduationCap,
};

export function getNavIcon(name: string): LucideIcon {
  return ICONS[name] ?? Puzzle;
}
