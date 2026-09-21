import "server-only";
import { prisma } from "@/lib/db";
import { isProjectKind, PROJECT_KIND_LABELS, type ProjectKind } from "@/lib/projects/features";
import type {
  PortfolioOverview,
  PortfolioProjectRow,
  ProjectHealth,
} from "@/lib/portfolio-types";

/**
 * Portfolio BI: one row per project, built for whoever has to answer
 * "how are my projects doing?" without opening each one.
 *
 * Every query is scoped by `projectIds`, which the caller resolves from the
 * workspace context — so the topbar filters govern these numbers too.
 */

export type {
  ProjectHealth,
  PortfolioProjectRow,
  PortfolioTotals,
  PortfolioOverview,
} from "@/lib/portfolio-types";

const IDLE_DAYS = 14;

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function countMap(rows: { projectId: string; _count: number }[]): Map<string, number> {
  return new Map(rows.map((r) => [r.projectId, r._count]));
}

export async function getPortfolioOverview(
  from: Date,
  to: Date,
  opts: { projectIds?: string[] } = {},
): Promise<PortfolioOverview> {
  const ids = opts.projectIds;
  const projectWhere = ids ? { id: { in: ids } } : {};
  const scopeFilter = ids ? { in: ids } : undefined;
  const now = new Date();

  const spanMs = Math.max(to.getTime() - from.getTime(), 86400000);
  const prevTo = new Date(from.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - spanMs);

  const projects = await prisma.project.findMany({
    where: projectWhere,
    select: {
      id: true,
      key: true,
      name: true,
      color: true,
      kind: true,
      status: true,
      memberships: { select: { role: true, user: { select: { name: true } } } },
    },
    orderBy: { name: "asc" },
  });

  if (projects.length === 0) {
    return {
      period: { from: from.toISOString(), to: to.toISOString(), days: Math.round(spanMs / 86400000) },
      previousPeriod: { from: prevFrom.toISOString(), to: prevTo.toISOString() },
      totals: {
        projects: 0,
        projectsAtRisk: 0,
        projectsCritical: 0,
        projectsIdle: 0,
        tasksOpen: 0,
        tasksOverdue: 0,
        tasksCompletedInPeriod: 0,
        tasksCompletedPrevPeriod: 0,
        throughputDeltaPct: null,
        deliverablesOpen: 0,
        deliverablesOverdue: 0,
        milestonesOverdue: 0,
        eventsInPeriod: 0,
      },
      projects: [],
      throughput: [],
      byKind: [],
    };
  }

  const scopedIds = projects.map((p) => p.id);
  const inScope = { in: scopedIds };

  const [
    tasksByStatus,
    tasksOverdue,
    tasksDoneInPeriod,
    tasksDonePrevPeriod,
    tasksCreatedInPeriod,
    deliverablesByStatus,
    deliverablesOverdue,
    milestones,
    reqByStatus,
    eventsByProject,
    lastEvents,
    completedRows,
    createdRows,
  ] = await Promise.all([
    prisma.task.groupBy({ by: ["projectId", "status"], where: { projectId: inScope }, _count: true }),
    prisma.task.groupBy({
      by: ["projectId"],
      where: { projectId: inScope, status: { not: "done" }, dueDate: { lt: now } },
      _count: true,
    }),
    prisma.task.groupBy({
      by: ["projectId"],
      where: { projectId: inScope, status: "done", updatedAt: { gte: from, lte: to } },
      _count: true,
    }),
    prisma.task.groupBy({
      by: ["projectId"],
      where: { projectId: inScope, status: "done", updatedAt: { gte: prevFrom, lte: prevTo } },
      _count: true,
    }),
    prisma.task.groupBy({
      by: ["projectId"],
      where: { projectId: inScope, createdAt: { gte: from, lte: to } },
      _count: true,
    }),
    prisma.deliverable.groupBy({
      by: ["projectId", "status"],
      where: { projectId: inScope },
      _count: true,
    }),
    prisma.deliverable.groupBy({
      by: ["projectId"],
      where: {
        projectId: inScope,
        status: { notIn: ["accepted", "rejected"] },
        dueDate: { lt: now },
      },
      _count: true,
    }),
    prisma.milestone.findMany({
      where: { projectId: inScope },
      select: { projectId: true, name: true, date: true, status: true },
    }),
    prisma.requirement.groupBy({
      by: ["projectId", "status"],
      where: { projectId: inScope },
      _count: true,
    }),
    prisma.activityLog.groupBy({
      by: ["projectId"],
      where: { projectId: inScope, createdAt: { gte: from, lte: to } },
      _count: true,
    }),
    prisma.activityLog.findMany({
      where: { projectId: inScope },
      orderBy: { createdAt: "desc" },
      distinct: ["projectId"],
      select: { projectId: true, createdAt: true },
    }),
    prisma.task.findMany({
      where: { projectId: inScope, status: "done", updatedAt: { gte: from, lte: to } },
      select: { updatedAt: true },
    }),
    prisma.task.findMany({
      where: { projectId: inScope, createdAt: { gte: from, lte: to } },
      select: { createdAt: true },
    }),
  ]);

  const overdueMap = countMap(tasksOverdue as { projectId: string; _count: number }[]);
  const doneInPeriodMap = countMap(tasksDoneInPeriod as { projectId: string; _count: number }[]);
  const donePrevMap = countMap(tasksDonePrevPeriod as { projectId: string; _count: number }[]);
  const createdMap = countMap(tasksCreatedInPeriod as { projectId: string; _count: number }[]);
  const delivOverdueMap = countMap(deliverablesOverdue as { projectId: string; _count: number }[]);
  const eventsMap = countMap(eventsByProject as { projectId: string; _count: number }[]);
  const lastEventMap = new Map(
    lastEvents.filter((e) => e.projectId).map((e) => [e.projectId!, e.createdAt]),
  );

  const taskStatusMap = new Map<string, Map<string, number>>();
  for (const row of tasksByStatus) {
    const inner = taskStatusMap.get(row.projectId) ?? new Map<string, number>();
    inner.set(row.status, row._count);
    taskStatusMap.set(row.projectId, inner);
  }

  const delivStatusMap = new Map<string, Map<string, number>>();
  for (const row of deliverablesByStatus) {
    const inner = delivStatusMap.get(row.projectId) ?? new Map<string, number>();
    inner.set(row.status, row._count);
    delivStatusMap.set(row.projectId, inner);
  }

  const reqMap = new Map<string, { total: number; approved: number }>();
  for (const row of reqByStatus) {
    const cur = reqMap.get(row.projectId) ?? { total: 0, approved: 0 };
    cur.total += row._count;
    if (row.status === "approved") cur.approved += row._count;
    reqMap.set(row.projectId, cur);
  }

  const milestoneMap = new Map<string, typeof milestones>();
  for (const m of milestones) {
    const list = milestoneMap.get(m.projectId) ?? [];
    list.push(m);
    milestoneMap.set(m.projectId, list);
  }

  const rows: PortfolioProjectRow[] = projects.map((p) => {
    const kind = isProjectKind(p.kind) ? p.kind : "lab";
    const statuses = taskStatusMap.get(p.id) ?? new Map<string, number>();
    const total = [...statuses.values()].reduce((s, n) => s + n, 0);
    const done = statuses.get("done") ?? 0;
    const inProgress = (statuses.get("in_progress") ?? 0) + (statuses.get("review") ?? 0);
    const overdue = overdueMap.get(p.id) ?? 0;

    const dStatuses = delivStatusMap.get(p.id) ?? new Map<string, number>();
    const dTotal = [...dStatuses.values()].reduce((s, n) => s + n, 0);
    const dAccepted = dStatuses.get("accepted") ?? 0;
    const dRejected = dStatuses.get("rejected") ?? 0;
    const dOverdue = delivOverdueMap.get(p.id) ?? 0;

    const ms = milestoneMap.get(p.id) ?? [];
    const reached = ms.filter((m) => m.status === "reached").length;
    const msOverdue = ms.filter(
      (m) => m.date && m.date < now && m.status !== "reached",
    ).length;
    const upcoming = ms
      .filter((m) => m.date && m.date >= now && m.status !== "reached")
      .sort((a, b) => (a.date!.getTime() - b.date!.getTime()))[0];

    const req = reqMap.get(p.id) ?? { total: 0, approved: 0 };
    const events = eventsMap.get(p.id) ?? 0;
    const lastAt = lastEventMap.get(p.id) ?? null;
    // Clamped at 0: a row timestamped slightly ahead of `now` must not read as
    // negative staleness and slip past the idle checks below.
    const daysSince = lastAt
      ? Math.max(0, Math.floor((now.getTime() - lastAt.getTime()) / 86400000))
      : null;

    const risks: string[] = [];
    if (overdue > 0) risks.push(`${overdue} tarefa(s) atrasada(s)`);
    if (dOverdue > 0) risks.push(`${dOverdue} entregavel(is) atrasado(s)`);
    if (msOverdue > 0) risks.push(`${msOverdue} marco(s) vencido(s)`);
    if (daysSince !== null && daysSince > IDLE_DAYS) risks.push(`sem atividade ha ${daysSince} dias`);
    if (daysSince === null) risks.push("nenhuma atividade registrada");
    if (total > 0 && done === total) risks.length = 0;

    const openTasks = total - done;
    let health: ProjectHealth;
    if (p.status === "archived") {
      health = "idle";
    } else if (overdue >= 5 || dOverdue >= 2 || msOverdue >= 1) {
      health = "critical";
    } else if (events === 0 && openTasks === 0 && total === 0) {
      health = "idle";
    } else if (overdue > 0 || dOverdue > 0 || (daysSince !== null && daysSince > IDLE_DAYS && openTasks > 0)) {
      health = "at_risk";
    } else if (events === 0 && (daysSince === null || daysSince > IDLE_DAYS)) {
      health = "idle";
    } else {
      health = "on_track";
    }

    return {
      id: p.id,
      key: p.key,
      name: p.name,
      color: p.color,
      kind,
      kindLabel: PROJECT_KIND_LABELS[kind],
      status: p.status,
      leads: p.memberships.filter((m) => m.role === "lead").map((m) => m.user.name),
      memberCount: p.memberships.length,
      tasks: {
        total,
        done,
        inProgress,
        open: openTasks,
        overdue,
        createdInPeriod: createdMap.get(p.id) ?? 0,
        completedInPeriod: doneInPeriodMap.get(p.id) ?? 0,
        completedPrevPeriod: donePrevMap.get(p.id) ?? 0,
      },
      deliverables: {
        total: dTotal,
        accepted: dAccepted,
        open: dTotal - dAccepted - dRejected,
        overdue: dOverdue,
      },
      milestones: {
        total: ms.length,
        reached,
        overdue: msOverdue,
        nextName: upcoming?.name ?? null,
        nextDate: upcoming?.date ? upcoming.date.toISOString() : null,
      },
      requirements: req,
      eventsInPeriod: events,
      lastActivityAt: lastAt ? lastAt.toISOString() : null,
      daysSinceActivity: daysSince,
      progressPct: total > 0 ? Math.round((done / total) * 100) : 0,
      health,
      risks,
    };
  });

  const completedInPeriod = rows.reduce((s, r) => s + r.tasks.completedInPeriod, 0);
  const completedPrev = rows.reduce((s, r) => s + r.tasks.completedPrevPeriod, 0);

  const throughputMap = new Map<string, { completed: number; created: number }>();
  const days = Math.max(1, Math.round(spanMs / 86400000));
  for (let i = 0; i <= days; i++) {
    throughputMap.set(dayKey(new Date(from.getTime() + i * 86400000)), { completed: 0, created: 0 });
  }
  for (const t of completedRows) {
    const key = dayKey(t.updatedAt);
    const cur = throughputMap.get(key);
    if (cur) cur.completed += 1;
  }
  for (const t of createdRows) {
    const key = dayKey(t.createdAt);
    const cur = throughputMap.get(key);
    if (cur) cur.created += 1;
  }

  const byKindMap = new Map<ProjectKind, { projects: number; tasksOpen: number; tasksOverdue: number }>();
  for (const r of rows) {
    const cur = byKindMap.get(r.kind) ?? { projects: 0, tasksOpen: 0, tasksOverdue: 0 };
    cur.projects += 1;
    cur.tasksOpen += r.tasks.open;
    cur.tasksOverdue += r.tasks.overdue;
    byKindMap.set(r.kind, cur);
  }

  return {
    period: { from: from.toISOString(), to: to.toISOString(), days },
    previousPeriod: { from: prevFrom.toISOString(), to: prevTo.toISOString() },
    totals: {
      projects: rows.length,
      projectsAtRisk: rows.filter((r) => r.health === "at_risk").length,
      projectsCritical: rows.filter((r) => r.health === "critical").length,
      projectsIdle: rows.filter((r) => r.health === "idle").length,
      tasksOpen: rows.reduce((s, r) => s + r.tasks.open, 0),
      tasksOverdue: rows.reduce((s, r) => s + r.tasks.overdue, 0),
      tasksCompletedInPeriod: completedInPeriod,
      tasksCompletedPrevPeriod: completedPrev,
      throughputDeltaPct:
        completedPrev > 0
          ? Math.round(((completedInPeriod - completedPrev) / completedPrev) * 100)
          : null,
      deliverablesOpen: rows.reduce((s, r) => s + r.deliverables.open, 0),
      deliverablesOverdue: rows.reduce((s, r) => s + r.deliverables.overdue, 0),
      milestonesOverdue: rows.reduce((s, r) => s + r.milestones.overdue, 0),
      eventsInPeriod: rows.reduce((s, r) => s + r.eventsInPeriod, 0),
    },
    projects: rows,
    throughput: [...throughputMap.entries()].map(([date, v]) => ({ date, ...v })),
    byKind: [...byKindMap.entries()].map(([kind, v]) => ({
      kind,
      kindLabel: PROJECT_KIND_LABELS[kind],
      ...v,
    })),
  };
}
