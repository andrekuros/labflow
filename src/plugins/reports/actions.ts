"use server";

import { prisma } from "@/lib/db";
import { emit } from "@/lib/events";
import { requirePermission, requireUser, hasPermission } from "@/lib/rbac";
import { formatProfilesLabel, legacyRoleToProfiles, normalizeProfiles } from "@/lib/profile-meta";
import { labelForEvent } from "@/lib/activity-log/constants";

export type UserActivitySummary = {
  user: { id: string; name: string; email: string; role: string; profilesLabel: string };
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
  profilesLabel: string;
  avatarColor: string;
  tasksCompleted: number;
  tasksTotal: number;
  deliverablesAccepted: number;
  totalEvents: number;
  lastEventAt: string | null;
};

export async function getUserActivitySummary(
  userId: string,
  from: Date,
  to: Date,
): Promise<UserActivitySummary> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true, profiles: { select: { profile: true } } },
  });
  const profiles = user.profiles.length
    ? normalizeProfiles(user.profiles.map((p) => p.profile))
    : legacyRoleToProfiles(user.role);
  const userSummary = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    profilesLabel: formatProfilesLabel(profiles),
  };

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
    label: labelForEvent(e.type),
    projectKey: e.projectId ? (projectMap.get(e.projectId)?.key ?? null) : null,
    createdAt: e.createdAt.toISOString(),
  }));

  const heatmap: Record<string, number> = {};
  events.forEach((e) => {
    const day = e.createdAt.toISOString().slice(0, 10);
    heatmap[day] = (heatmap[day] ?? 0) + 1;
  });

  return {
    user: userSummary,
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
      deliverablesAccepted: 0,
      totalEvents: eventCountMap.get(u.id) ?? 0,
      lastEventAt: lastEventMap.get(u.id) ?? null,
    };
  });
}

export async function generateWeeklyReportNow(options?: {
  format?: "pdf" | "markdown" | "both";
  sendEmail?: boolean;
  from?: string;
  to?: string;
  aiSections?: import("@/plugins/reports/ai-sections").AiAnalysisSection[];
}): Promise<{
  ok: boolean;
  error?: string;
  filename?: string;
  pdfBase64?: string;
  markdown?: string;
  markdownFilename?: string;
  emailed?: boolean;
  recipients?: string[];
  aiUsed?: boolean;
}> {
  const user = await requirePermission("report:view_all");
  const { runWeeklyLabReport } = await import("@/plugins/reports/weekly/run");
  const format = options?.format ?? "both";
  const sendEmail = options?.sendEmail === true;
  return runWeeklyLabReport({
    actorId: user.id,
    sendEmail,
    includePdfBase64: format === "pdf" || format === "both" || sendEmail,
    includeMarkdown: format === "markdown" || format === "both",
    format: sendEmail ? "both" : format,
    from: options?.from ? new Date(options.from) : undefined,
    to: options?.to ? new Date(`${options.to}T23:59:59.999`) : undefined,
    aiSections: options?.aiSections,
  });
}

export async function exportActivityReport(options: {
  userId: string;
  from: string;
  to: string;
  format: "pdf" | "markdown" | "both";
  aiSections?: import("@/plugins/reports/ai-sections").AiAnalysisSection[];
}): Promise<{
  ok: boolean;
  error?: string;
  filename?: string;
  pdfBase64?: string;
  markdown?: string;
  markdownFilename?: string;
  aiUsed?: boolean;
}> {
  const session = await requireUser();
  const canAll = await hasPermission(session, "report:view_all");
  const targetUserId = canAll ? options.userId : session.id;
  if (!canAll && options.userId !== session.id) {
    return { ok: false, error: "Sem permissao" };
  }

  try {
    const from = new Date(options.from);
    const to = new Date(`${options.to}T23:59:59.999`);
    const summary = await getUserActivitySummary(targetUserId, from, to);
    const { generateActivityAiNarrative } = await import("@/plugins/reports/activity-ai");
    const { generateActivityReportPdf } = await import("@/plugins/reports/activity-pdf");
    const { generateReportMarkdown } = await import("@/plugins/reports/report-markdown");

    const narrative = await generateActivityAiNarrative(summary, options.aiSections);
    const slug = summary.user.name.replace(/\s+/g, "-").toLowerCase();
    const dateKey = options.from;
    const wantPdf = options.format === "pdf" || options.format === "both";
    const wantMd = options.format === "markdown" || options.format === "both";

    const pdf = wantPdf ? await generateActivityReportPdf(summary, narrative) : null;
    const markdown = wantMd ? generateReportMarkdown(summary, narrative) : undefined;

    return {
      ok: true,
      filename: pdf ? `relatorio-${slug}-${dateKey}.pdf` : undefined,
      pdfBase64: pdf ? pdf.toString("base64") : undefined,
      markdown,
      markdownFilename: markdown ? `relatorio-${slug}-${dateKey}.md` : undefined,
      aiUsed: narrative.aiUsed,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Falha ao exportar" };
  }
}

export async function exportLabPresentation(options: {
  from: string;
  to: string;
  aiSections?: import("@/plugins/reports/ai-sections").AiAnalysisSection[];
}): Promise<{
  ok: boolean;
  error?: string;
  filename?: string;
  pdfBase64?: string;
  aiUsed?: boolean;
}> {
  const user = await requirePermission("report:view_all");
  try {
    const from = new Date(options.from);
    const to = new Date(`${options.to}T23:59:59.999`);
    const { collectWeeklyLabReportData } = await import("@/plugins/reports/weekly/data");
    const { generateWeeklyNarrative } = await import("@/plugins/reports/weekly/agent");
    const { generateLabPresentationPdf } = await import("@/plugins/reports/presentation-pdf");
    const { getLabBranding } = await import("@/lib/lab-branding");

    const data = await collectWeeklyLabReportData(from, to);
    const narrative = await generateWeeklyNarrative(
      data,
      options.aiSections?.length
        ? options.aiSections
        : [
            "executiveSummary",
            "highlights",
            "pendenciesAndRisks",
            "workflowImprovements",
            "otherSuggestions",
          ],
    );
    const branding = await getLabBranding();
    const pdf = await generateLabPresentationPdf(data, narrative, branding.name);
    const filename = `labflow-apresentacao-${options.from}.pdf`;

    await emit({
      type: "report.weekly_sent",
      actorId: user.id,
      payload: {
        kind: "presentation",
        from: from.toISOString(),
        to: to.toISOString(),
        aiUsed: narrative.aiUsed,
      },
    });

    return {
      ok: true,
      filename,
      pdfBase64: pdf.toString("base64"),
      aiUsed: narrative.aiUsed,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Falha ao gerar apresentacao" };
  }
}

