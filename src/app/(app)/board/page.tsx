import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { viewableProjectIds, writableMap } from "@/lib/projects";
import { KanbanBoard } from "@/components/board/kanban-board";
import { EmptyState } from "@/components/ui";

export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<{ assignee?: string; project?: string }>;
}) {
  const session = await requireUser();
  const { assignee, project } = await searchParams;
  const projectIds = await viewableProjectIds(session);

  if (projectIds.length === 0) {
    return <EmptyState title="Nenhum projeto" description="Voce ainda nao participa de nenhum projeto. Crie um em Projetos." />;
  }

  const [projects, tasks, members, labels, sprints, canWrite] = await Promise.all([
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
    writableMap(session, projectIds),
  ]);

  return (
    <KanbanBoard
      currentUserId={session.id}
      initialAssignee={assignee ?? ""}
      initialProject={project ?? ""}
      projects={projects.map((p) => ({ id: p.id, key: p.key, name: p.name, color: p.color }))}
      members={members.map((m) => ({ id: m.id, name: m.name, avatarColor: m.avatarColor }))}
      labels={labels.map((l) => ({ id: l.id, name: l.name, color: l.color, projectId: l.projectId }))}
      sprints={sprints.map((s) => ({ id: s.id, name: s.name, projectId: s.projectId, status: s.status }))}
      canWrite={canWrite}
      tasks={tasks.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate ? t.dueDate.toISOString() : null,
        projectId: t.projectId,
        projectKey: t.project.key,
        projectColor: t.project.color,
        sprintId: t.sprintId,
        workPackageId: t.workPackageId,
        assignees: t.assignees.map((a) => ({ id: a.id, name: a.name, avatarColor: a.avatarColor })),
        labels: t.labels.map((l) => ({ id: l.id, name: l.name, color: l.color })),
      }))}
    />
  );
}
