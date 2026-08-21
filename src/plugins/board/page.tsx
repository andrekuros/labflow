import { Suspense } from "react";
import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { workspaceProjectIds, getUserWorkspace } from "@/lib/workspace";
import { writableMap } from "@/lib/projects";
import { KanbanBoard } from "@/components/board/kanban-board";
import { EmptyState } from "@/components/ui";
import { getBoardColumnsMap } from "@/plugins/board/columns";
import { parseChecklist } from "@/lib/task-checklist";
import { parsePreferences } from "@/lib/user-preferences";

export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireUser();
  await searchParams;
  const projectIds = await workspaceProjectIds(session);
  const ws = await getUserWorkspace(session.id);

  if (projectIds.length === 0) {
    return (
      <EmptyState
        title="Nenhum projeto"
        description="Nenhum projeto no contexto atual. Ajuste os filtros de tipo no menu."
      />
    );
  }

  const lockedProject =
    ws.mode === "project" && ws.projectId && projectIds.includes(ws.projectId)
      ? ws.projectId
      : projectIds.length === 1
        ? projectIds[0]
        : "";
  const initialProject = lockedProject || "";
  const projectLocked = Boolean(
    (ws.mode === "project" && ws.projectId && projectIds.includes(ws.projectId)) ||
      projectIds.length === 1,
  );

  const [projects, tasks, members, labels, sprints, workPackages, canWrite, projectColumns, userRow] =
    await Promise.all([
      prisma.project.findMany({ where: { id: { in: projectIds } }, orderBy: { name: "asc" } }),
      prisma.task.findMany({
        where: { projectId: { in: projectIds } },
        include: { assignees: true, labels: true, project: true },
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      }),
      prisma.user.findMany({
        where: { memberships: { some: { projectId: { in: projectIds } } } },
        orderBy: { name: "asc" },
      }),
      prisma.label.findMany({ where: { projectId: { in: projectIds } } }),
      prisma.sprint.findMany({ where: { projectId: { in: projectIds } }, orderBy: { createdAt: "desc" } }),
      prisma.workPackage.findMany({
        where: { projectId: { in: projectIds } },
        orderBy: [{ order: "asc" }],
        select: { id: true, code: true, name: true, projectId: true, parentId: true },
      }),
      writableMap(session, projectIds),
      getBoardColumnsMap(projectIds),
      prisma.user.findUnique({ where: { id: session.id }, select: { preferences: true } }),
    ]);

  const prefs = parsePreferences(userRow?.preferences);
  const savedViews = prefs.boardViews ?? [];
  const preferredBoardViewId = prefs.preferredBoardViewId ?? null;

  const linkCounts = tasks.length
    ? await prisma.knowledgeLink.groupBy({
        by: ["targetId"],
        where: { targetType: "task", targetId: { in: tasks.map((t) => t.id) } },
        _count: true,
      })
    : [];
  const linkCountByTask = new Map(linkCounts.map((c) => [c.targetId, c._count]));

  return (
    <Suspense fallback={<div className="text-sm text-muted">Carregando quadro...</div>}>
      <KanbanBoard
        currentUserId={session.id}
        initialProject={initialProject}
        projectLocked={projectLocked}
        savedViews={savedViews}
        preferredBoardViewId={preferredBoardViewId}
        projects={projects.map((p) => ({ id: p.id, key: p.key, name: p.name, color: p.color }))}
        members={members.map((m) => ({ id: m.id, name: m.name, avatarColor: m.avatarColor }))}
        labels={labels.map((l) => ({ id: l.id, name: l.name, color: l.color, projectId: l.projectId }))}
        sprints={sprints.map((s) => ({ id: s.id, name: s.name, projectId: s.projectId, status: s.status }))}
        workPackages={workPackages.map((w) => ({
          id: w.id,
          code: w.code,
          name: w.name,
          projectId: w.projectId,
          parentId: w.parentId,
        }))}
        canWrite={canWrite}
        projectColumns={projectColumns}
        tasks={tasks.map((t) => ({
          id: t.id,
          title: t.title,
          description: t.description,
          status: t.status,
          order: t.order,
          priority: t.priority,
          dueDate: t.dueDate ? t.dueDate.toISOString() : null,
          projectId: t.projectId,
          projectKey: t.project.key,
          projectColor: t.project.color,
          sprintId: t.sprintId,
          workPackageId: t.workPackageId,
          checklist: parseChecklist(t.checklistJson),
          assignees: t.assignees.map((a) => ({ id: a.id, name: a.name, avatarColor: a.avatarColor })),
          labels: t.labels.map((l) => ({ id: l.id, name: l.name, color: l.color })),
          knowledgeLinkCount: linkCountByTask.get(t.id) ?? 0,
        }))}
      />
    </Suspense>
  );
}
