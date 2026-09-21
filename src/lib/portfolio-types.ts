/** Portfolio BI types — pure, importable from client components. */

import type { ProjectKind } from "@/lib/projects/features";

export type ProjectHealth = "on_track" | "at_risk" | "critical" | "idle";

export type PortfolioProjectRow = {
  id: string;
  key: string;
  name: string;
  color: string;
  kind: ProjectKind;
  kindLabel: string;
  status: string;
  leads: string[];
  memberCount: number;
  tasks: {
    total: number;
    done: number;
    inProgress: number;
    open: number;
    overdue: number;
    createdInPeriod: number;
    completedInPeriod: number;
    completedPrevPeriod: number;
  };
  deliverables: { total: number; accepted: number; open: number; overdue: number };
  milestones: {
    total: number;
    reached: number;
    overdue: number;
    nextName: string | null;
    nextDate: string | null;
  };
  requirements: { total: number; approved: number };
  eventsInPeriod: number;
  lastActivityAt: string | null;
  daysSinceActivity: number | null;
  progressPct: number;
  health: ProjectHealth;
  risks: string[];
};

export type PortfolioTotals = {
  projects: number;
  projectsAtRisk: number;
  projectsCritical: number;
  projectsIdle: number;
  tasksOpen: number;
  tasksOverdue: number;
  tasksCompletedInPeriod: number;
  tasksCompletedPrevPeriod: number;
  throughputDeltaPct: number | null;
  deliverablesOpen: number;
  deliverablesOverdue: number;
  milestonesOverdue: number;
  eventsInPeriod: number;
};

export type PortfolioOverview = {
  period: { from: string; to: string; days: number };
  previousPeriod: { from: string; to: string };
  totals: PortfolioTotals;
  projects: PortfolioProjectRow[];
  /** Throughput per day across the scope — feeds the trend sparkline. */
  throughput: { date: string; completed: number; created: number }[];
  byKind: { kind: ProjectKind; kindLabel: string; projects: number; tasksOpen: number; tasksOverdue: number }[];
};
