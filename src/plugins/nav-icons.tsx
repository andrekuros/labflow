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
  MessageSquareWarning,
  BarChart3,
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
  MessageSquareWarning,
  BarChart3,
};

export function getNavIcon(name: string): LucideIcon {
  return ICONS[name] ?? Puzzle;
}
