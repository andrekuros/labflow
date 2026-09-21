/** Health vocabulary shared by the dashboard, the reports UI and the PDFs. */

import type { ProjectHealth } from "@/lib/portfolio-types";

export const HEALTH_META: Record<
  ProjectHealth,
  { label: string; color: string; short: string; order: number }
> = {
  critical: { label: "Critico", short: "Critico", color: "#ef4444", order: 0 },
  at_risk: { label: "Em risco", short: "Risco", color: "#f59e0b", order: 1 },
  idle: { label: "Parado", short: "Parado", color: "#94a3b8", order: 2 },
  on_track: { label: "Em curso", short: "Em curso", color: "#22c55e", order: 3 },
};

export const HEALTH_ORDER: ProjectHealth[] = ["critical", "at_risk", "idle", "on_track"];

/** Most urgent first — the order a manager wants to read the portfolio in. */
export function byHealthThenOverdue<
  T extends { health: ProjectHealth; tasks: { overdue: number }; name: string },
>(a: T, b: T): number {
  const d = HEALTH_META[a.health].order - HEALTH_META[b.health].order;
  if (d !== 0) return d;
  if (b.tasks.overdue !== a.tasks.overdue) return b.tasks.overdue - a.tasks.overdue;
  return a.name.localeCompare(b.name);
}

export function formatDelta(pct: number | null): { text: string; tone: "up" | "down" | "flat" } {
  if (pct === null) return { text: "sem base anterior", tone: "flat" };
  if (pct === 0) return { text: "estavel", tone: "flat" };
  return { text: `${pct > 0 ? "+" : ""}${pct}% vs. periodo anterior`, tone: pct > 0 ? "up" : "down" };
}
