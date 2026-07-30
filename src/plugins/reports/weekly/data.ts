import "server-only";
import { prisma } from "@/lib/db";
import { labelForEvent } from "@/lib/activity-log/constants";
import { formatProfilesLabel, legacyRoleToProfiles, normalizeProfiles } from "@/lib/profile-meta";

const STUCK_DAYS = 7;

export type WeeklyReportPeriod = { from: string; to: string };

export type WeeklyTeamMember = {
  id: string;
  name: string;
  role: string;
  profilesLabel: string;
  avatarColor: string;
  tasksCompleted: number;
  tasksTotal: number;
  totalEvents: number;
  lastEventAt: string | null;
};

export type WeeklyPendencyItem = {
  kind: "task" | "deliverable" | "feedback" | "academic";
  title: string;
  detail: string;
  projectKey: string | null;
  dueDate: string | null;
  owner: string | null;
};

export type WeeklyProjectHealth = {
  id: string;
  key: string;
  name: string;
  status: string;
  tasksTotal: number;
  tasksDone: number;
  tasksInProgress: number;
  tasksReview: number;
  tasksOverdue: number;
};

export type WeeklyActivityBucket = {
  type: string;
  label: string;
  count: number;
};

export type WeeklyLabReportData = {
  period: WeeklyReportPeriod;
  generatedAt: string;
  team: WeeklyTeamMember[];
  activityByType: WeeklyActivityBucket[];
  totalEvents: number;
  pendencies: WeeklyPendencyItem[];
  projects: WeeklyProjectHealth[];
  openFeedbackCount: number;
  inactiveMembers: { id: string; name: string; lastEventAt: string | null }[];
};

export function defaultWeeklyPeriod(now = new Date()): { from: Date; to: Date } {
  const to = now;
  const from = new Date(to.getTime() - 7 * 86400000);
  return { from, to };
}

async function loadTeamOverview(from: Date, to: Date): Promise<WeeklyTeamMember[]> {
  const users = await prisma.user.findMany({
    where: { accountStatus: "active" },
    select: {
      id: true,
      name: true,
      role: true,
      avatarColor: true,
      profiles: { select: { profile: true } },
    },
    orderBy: { name: "asc" },
  });

  const [eventCounts, lastEvents, taskStats] = await Promise.all([
    prisma.activityLog.groupBy({
      by: ["actorId"],
      where: { createdAt: { gte: from, lte: to }, actorId: { not: null } },
      _count: true,
    }),
    prisma.activityLog.findMany({
      where: { actorId: { in: users.map((u) => u.id) } },
      orderBy: { createdAt: "desc" },
      distinct: ["actorId"],
      select: { actorId: true, createdAt: true },
    }),
    prisma.task.findMany({
      where: { assignees: { some: { id: { in: users.map((u) => u.id) } } } },
      select: { id: true, status: true, updatedAt: true, assignees: { select: { id: true } } },
    }),
  ]);

  const eventCountMap = new Map(eventCounts.map((e) => [e.actorId, e._count]));
  const lastEventMap = new Map(lastEvents.map((e) => [e.actorId, e.createdAt.toISOString()]));

  const tasksByUser = new Map<string, { total: number; completed: number }>();
  taskStats.forEach((t) => {
    t.assignees.forEach((a) => {
      const cur = tasksByUser.get(a.id) ?? { total: 0, completed: 0 };
      cur.total += 1;
      if (t.status === "done" && t.updatedAt >= from && t.updatedAt <= to) {
        cur.completed += 1;
      }
      tasksByUser.set(a.id, cur);
    });
  });

  return users.map((u) => {
    const ts = tasksByUser.get(u.id) ?? { total: 0, completed: 0 };
    const profiles = u.profiles.length
      ? normalizeProfiles(u.profiles.map((p) => p.profile))
      : legacyRoleToProfiles(u.role);
    return {
      id: u.id,
      name: u.name,
      role: u.role,
      profilesLabel: formatProfilesLabel(profiles),
      avatarColor: u.avatarColor,
      tasksCompleted: ts.completed,
      tasksTotal: ts.total,
      totalEvents: eventCountMap.get(u.id) ?? 0,
      lastEventAt: lastEventMap.get(u.id) ?? null,
    };
  });
}

export async function collectWeeklyLabReportData(
  from: Date,
  to: Date,
): Promise<WeeklyLabReportData> {
  const now = new Date();
  const stuckBefore = new Date(now.getTime() - STUCK_DAYS * 86400000);

  const [team, events, overdueTasks, stuckTasks, overdueDeliverables, openFeedback, projects, academicProfiles] =
    await Promise.all([
      loadTeamOverview(from, to),
      prisma.activityLog.groupBy({
        by: ["type"],
        where: { createdAt: { gte: from, lte: to } },
        _count: true,
      }),
      prisma.task.findMany({
        where: {
          status: { not: "done" },
          dueDate: { lt: now },
        },
        include: {
          project: { select: { key: true } },
          assignees: { select: { name: true } },
        },
        orderBy: { dueDate: "asc" },
        take: 40,
      }),
      prisma.task.findMany({
        where: {
          status: { in: ["in_progress", "review"] },
          updatedAt: { lt: stuckBefore },
        },
        include: {
          project: { select: { key: true } },
          assignees: { select: { name: true } },
        },
        orderBy: { updatedAt: "asc" },
        take: 30,
      }),
      prisma.deliverable.findMany({
        where: {
          status: { notIn: ["accepted", "rejected"] },
          dueDate: { lt: now },
        },
        include: { project: { select: { key: true } } },
        orderBy: { dueDate: "asc" },
        take: 30,
      }),
      prisma.feedback.findMany({
        where: { status: { in: ["open", "triaged", "in_progress"] } },
        include: {
          assignee: { select: { name: true } },
          project: { select: { key: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 20,
      }),
      prisma.project.findMany({
        where: { status: { not: "archived" } },
        select: {
          id: true,
          key: true,
          name: true,
          status: true,
          tasks: { select: { status: true, dueDate: true } },
        },
        orderBy: { name: "asc" },
      }),
      prisma.academicProfile.findMany({
        where: { status: { not: "completed" } },
        include: { user: { select: { name: true } } },
      }),
    ]);

  const pendencies: WeeklyPendencyItem[] = [];

  for (const t of overdueTasks) {
    pendencies.push({
      kind: "task",
      title: t.title,
      detail: `Tarefa atrasada (${t.status})`,
      projectKey: t.project.key,
      dueDate: t.dueDate ? t.dueDate.toISOString() : null,
      owner: t.assignees.map((a) => a.name).join(", ") || null,
    });
  }

  for (const t of stuckTasks) {
    if (overdueTasks.some((o) => o.id === t.id)) continue;
    pendencies.push({
      kind: "task",
      title: t.title,
      detail: `Parada em ${t.status} ha mais de ${STUCK_DAYS} dias`,
      projectKey: t.project.key,
      dueDate: t.dueDate ? t.dueDate.toISOString() : null,
      owner: t.assignees.map((a) => a.name).join(", ") || null,
    });
  }

  for (const d of overdueDeliverables) {
    pendencies.push({
      kind: "deliverable",
      title: d.name,
      detail: `Entregavel atrasado (${d.status})`,
      projectKey: d.project.key,
      dueDate: d.dueDate ? d.dueDate.toISOString() : null,
      owner: null,
    });
  }

  for (const f of openFeedback) {
    pendencies.push({
      kind: "feedback",
      title: f.title,
      detail: `Feedback ${f.category} (${f.status})`,
      projectKey: f.project?.key ?? null,
      dueDate: null,
      owner: f.assignee?.name ?? null,
    });
  }

  for (const a of academicProfiles) {
    const pending = JSON.parse(a.pendingJson || "[]") as unknown[];
    if (pending.length === 0) continue;
    pendencies.push({
      kind: "academic",
      title: `Pendencias academicas — ${a.user.name}`,
      detail: `${pending.length} item(ns) no programa ${a.program}`,
      projectKey: null,
      dueDate: null,
      owner: a.user.name,
    });
  }

  const projectHealth: WeeklyProjectHealth[] = projects.map((p) => {
    const tasksDone = p.tasks.filter((t) => t.status === "done").length;
    const tasksInProgress = p.tasks.filter((t) => t.status === "in_progress").length;
    const tasksReview = p.tasks.filter((t) => t.status === "review").length;
    const tasksOverdue = p.tasks.filter(
      (t) => t.status !== "done" && t.dueDate && t.dueDate < now,
    ).length;
    return {
      id: p.id,
      key: p.key,
      name: p.name,
      status: p.status,
      tasksTotal: p.tasks.length,
      tasksDone,
      tasksInProgress,
      tasksReview,
      tasksOverdue,
    };
  });

  const activityByType: WeeklyActivityBucket[] = events
    .map((e) => ({
      type: e.type,
      label: labelForEvent(e.type),
      count: e._count,
    }))
    .sort((a, b) => b.count - a.count);

  const totalEvents = activityByType.reduce((sum, e) => sum + e.count, 0);

  const inactiveMembers = team
    .filter((m) => m.totalEvents === 0)
    .map((m) => ({ id: m.id, name: m.name, lastEventAt: m.lastEventAt }));

  return {
    period: { from: from.toISOString(), to: to.toISOString() },
    generatedAt: now.toISOString(),
    team,
    activityByType,
    totalEvents,
    pendencies,
    projects: projectHealth,
    openFeedbackCount: openFeedback.length,
    inactiveMembers,
  };
}
