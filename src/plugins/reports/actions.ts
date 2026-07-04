"use server";

import { prisma } from "@/lib/db";

export type UserActivitySummary = {
  user: { id: string; name: string; email: string; role: string; title: string | null };
  period: { from: string; to: string };
  kpis: {
    tasksCreated: number;
    tasksCompleted: number;
    tasksInProgress: number;
    deliverablesSubmitted: number;
    deliverablesAccepted: number;
    requirementsCreated: number;
    forumPosts: number;
    feedbackSubmitted: number;
    totalEvents: number;
  };
  tasksByProject: {
    projectId: string;
    projectKey: string;
    projectName: string;
    projectColor: string;
    tasks: { id: string; title: string; status: string; priority: string; sprintName: string | null; dueDate: string | null }[];
  }[];
  deliverables: {
    id: string; name: string; status: string; projectKey: string; projectColor: string; dueDate: string | null;
  }[];
  academic: {
    program: string; status: string; objective: string; advisorName: string | null;
    coursesTotal: number; coursesDone: number; pendingCount: number;
  } | null;
  timeline: { id: string; type: string; label: string; projectKey: string | null; createdAt: string }[];
  heatmap: Record<string, number>;
};

export type TeamMemberOverview = {
  id: string;
  name: string;
  role: string;
  title: string | null;
  avatarColor: string;
  tasksCompleted: number;
  tasksTotal: number;
  deliverablesAccepted: number;
  totalEvents: number;
  lastEventAt: string | null;
};

const EVENT_LABELS: Record<string, string> = {
  "task.created": "Tarefa criada",
  "task.updated": "Tarefa atualizada",
  "task.moved": "Tarefa movida",
  "deliverable.created": "Entregavel criado",
  "deliverable.updated": "Entregavel atualizado",
  "requirement.created": "Requisito criado",
  "article.created": "Artigo criado",
  "article.updated": "Artigo atualizado",
  "thread.created": "Topico criado",
  "post.created": "Post no forum",
  "project.created": "Projeto criado",
  "project.updated": "Projeto atualizado",
  "feedback.submitted": "Feedback enviado",
  "academic.updated": "Perfil academico atualizado",
};

export async function getUserActivitySummary(
  userId: string,
  from: Date,
  to: Date,
): Promise<UserActivitySummary> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true, title: true },
  });

  const [events, tasks, deliverables, academicProfile] = await Promise.all([
    prisma.activityLog.findMany({
      where: { actorId: userId, createdAt: { gte: from, lte: to } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.task.findMany({
      where: { assignees: { some: { id: userId } } },
      include: { project: true, sprint: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.deliverable.findMany({
      where: {
        project: { memberships: { some: { userId } } },
        updatedAt: { gte: from, lte: to },
      },
      include: { project: true },
    }),
    prisma.academicProfile.findUnique({ where: { userId } }),
  ]);

  const projectMap = new Map<string, { id: string; key: string; name: string; color: string }>();
  const projectIds = [...new Set(events.filter((e) => e.projectId).map((e) => e.projectId!))];
  if (projectIds.length > 0) {
    const projects = await prisma.project.findMany({ where: { id: { in: projectIds } } });
    projects.forEach((p) => projectMap.set(p.id, { id: p.id, key: p.key, name: p.name, color: p.color }));
  }
  tasks.forEach((t) => {
    if (!projectMap.has(t.projectId)) {
      projectMap.set(t.projectId, { id: t.project.id, key: t.project.key, name: t.project.name, color: t.project.color });
    }
  });

  const countType = (type: string) => events.filter((e) => e.type === type).length;

  const completedInPeriod = tasks.filter(
    (t) => t.status === "done" && t.updatedAt >= from && t.updatedAt <= to,
  );
  const inProgress = tasks.filter((t) => t.status === "in_progress" || t.status === "review");

  const kpis = {
    tasksCreated: countType("task.created"),
    tasksCompleted: completedInPeriod.length,
    tasksInProgress: inProgress.length,
    deliverablesSubmitted: countType("deliverable.created") + countType("deliverable.updated"),
    deliverablesAccepted: deliverables.filter((d) => d.status === "accepted").length,
    requirementsCreated: countType("requirement.created"),
    forumPosts: countType("post.created") + countType("thread.created"),
    feedbackSubmitted: countType("feedback.submitted"),
    totalEvents: events.length,
  };

  const tasksByProjectMap = new Map<string, typeof tasks>();
  tasks.forEach((t) => {
    const list = tasksByProjectMap.get(t.projectId) ?? [];
    list.push(t);
    tasksByProjectMap.set(t.projectId, list);
  });

  const tasksByProject = [...tasksByProjectMap.entries()].map(([pid, ptasks]) => {
    const proj = projectMap.get(pid) ?? { id: pid, key: "?", name: pid, color: "#6366f1" };
    return {
      projectId: pid,
      projectKey: proj.key,
      projectName: proj.name,
      projectColor: proj.color,
      tasks: ptasks.map((t) => ({
        id: t.id, title: t.title, status: t.status, priority: t.priority,
        sprintName: t.sprint?.name ?? null,
        dueDate: t.dueDate ? t.dueDate.toISOString() : null,
      })),
    };
  });

  const mappedDeliverables = deliverables.map((d) => ({
    id: d.id, name: d.name, status: d.status,
    projectKey: d.project.key, projectColor: d.project.color,
    dueDate: d.dueDate ? d.dueDate.toISOString() : null,
  }));

  let academic: UserActivitySummary["academic"] = null;
  if (academicProfile) {
    const courses = JSON.parse(academicProfile.coursesJson || "[]") as { status?: string }[];
    const pending = JSON.parse(academicProfile.pendingJson || "[]") as unknown[];
    academic = {
      program: academicProfile.program,
      status: academicProfile.status,
      objective: academicProfile.objective,
      advisorName: academicProfile.advisorName,
      coursesTotal: courses.length,
      coursesDone: courses.filter((c) => c.status === "completed").length,
      pendingCount: pending.length,
    };
  }

  const timeline = events.slice(0, 50).map((e) => ({
    id: e.id,
    type: e.type,
    label: EVENT_LABELS[e.type] ?? e.type,
    projectKey: e.projectId ? (projectMap.get(e.projectId)?.key ?? null) : null,
    createdAt: e.createdAt.toISOString(),
  }));

  const heatmap: Record<string, number> = {};
  events.forEach((e) => {
    const day = e.createdAt.toISOString().slice(0, 10);
    heatmap[day] = (heatmap[day] ?? 0) + 1;
  });

  return {
    user,
    period: { from: from.toISOString(), to: to.toISOString() },
    kpis,
    tasksByProject,
    deliverables: mappedDeliverables,
    academic,
    timeline,
    heatmap,
  };
}

export async function getTeamOverview(from: Date, to: Date): Promise<TeamMemberOverview[]> {
  const users = await prisma.user.findMany({
    where: { accountStatus: "active" },
    select: { id: true, name: true, role: true, title: true, avatarColor: true },
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

  const tasksByUser = new Map<string, { total: number; completed: number; accepted: number }>();
  taskStats.forEach((t) => {
    t.assignees.forEach((a) => {
      const cur = tasksByUser.get(a.id) ?? { total: 0, completed: 0, accepted: 0 };
      cur.total += 1;
      if (t.status === "done" && t.updatedAt >= from && t.updatedAt <= to) {
        cur.completed += 1;
      }
      tasksByUser.set(a.id, cur);
    });
  });

  return users.map((u) => {
    const ts = tasksByUser.get(u.id) ?? { total: 0, completed: 0, accepted: 0 };
    return {
      id: u.id,
      name: u.name,
      role: u.role,
      title: u.title,
      avatarColor: u.avatarColor,
      tasksCompleted: ts.completed,
      tasksTotal: ts.total,
      deliverablesAccepted: 0,
      totalEvents: eventCountMap.get(u.id) ?? 0,
      lastEventAt: lastEventMap.get(u.id) ?? null,
    };
  });
}

