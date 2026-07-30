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
  ClipboardList,
  BarChart3,
  FileText,
  ScrollText,
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
  ClipboardList,
  BarChart3,
  FileText,
  ScrollText,
};

export function getNavIcon(name: string): LucideIcon {
  return ICONS[name] ?? Puzzle;
}
