import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { canViewProject, canWriteProject } from "@/lib/rbac";
import { Card, Badge, Avatar, PageHeader, LinkButton } from "@/components/ui";
import { AddWorkPackageForm, AddLabelForm, AddMemberForm } from "@/components/projects/project-forms";
import { ProjectCockpit } from "@/components/projects/project-cockpit";
import { KanbanSquare } from "lucide-react";

const WBS_STATUS: Record<string, string> = { planned: "Planejada", in_progress: "Em andamento", done: "Concluida", blocked: "Bloqueada" };

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireUser();
  if (!(await canViewProject(session, id))) notFound();
  const writable = await canWriteProject(session, id);

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      workPackages: { orderBy: [{ order: "asc" }], include: { _count: { select: { tasks: true } } } },
      labels: true,
      memberships: { include: { user: true } },
      sprints: { orderBy: { createdAt: "desc" } },
      _count: { select: { tasks: true, deliverables: true, requirements: true } },
    },
  });
  if (!project) notFound();

  const [openTasks, deliverables, articles, channels, taskIds, deliverableIds, requirementIds, reqApproved, reqTotal, vvPassed, vvTotal, systemElementCount] = await Promise.all([
    prisma.task.count({ where: { projectId: id, status: { not: "done" } } }),
    prisma.deliverable.findMany({
      where: { projectId: id, status: { notIn: ["accepted", "rejected"] } },
      orderBy: { dueDate: "asc" },
      take: 5,
    }),
    prisma.knowledgeArticle.findMany({
      where: { projectId: id },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    prisma.channel.findMany({ where: { projectId: id }, select: { id: true } }),
    prisma.task.findMany({ where: { projectId: id }, select: { id: true } }),
    prisma.deliverable.findMany({ where: { projectId: id }, select: { id: true } }),
    prisma.requirement.findMany({ where: { projectId: id }, select: { id: true } }),
    prisma.requirement.count({ where: { projectId: id, status: "approved" } }),
    prisma.requirement.count({ where: { projectId: id } }),
    prisma.verificationCase.count({ where: { projectId: id, status: "passed" } }),
    prisma.verificationCase.count({ where: { projectId: id } }),
    prisma.systemElement.count({ where: { projectId: id } }),
  ]);

  const linkCount = await prisma.knowledgeLink.count({
    where: {
      OR: [
        { targetType: "task", targetId: { in: taskIds.map((t) => t.id) } },
        { targetType: "deliverable", targetId: { in: deliverableIds.map((d) => d.id) } },
        { targetType: "requirement", targetId: { in: requirementIds.map((r) => r.id) } },
      ],
    },
  });

  const threads = channels.length
    ? await prisma.thread.findMany({
        where: { channelId: { in: channels.map((c) => c.id) } },
        orderBy: { updatedAt: "desc" },
        take: 5,
      })
    : [];

  const activeSprint = project.sprints.find((s) => s.status === "active") ?? project.sprints[0] ?? null;

  const allUsers = await prisma.user.findMany();
  const memberIds = new Set(project.memberships.map((m) => m.userId));
  const candidates = allUsers.filter((u) => !memberIds.has(u.id)).map((u) => ({ id: u.id, name: u.name }));

  const roots = project.workPackages.filter((w) => !w.parentId);
  const childrenOf = (pid: string) => project.workPackages.filter((w) => w.parentId === pid);

  function Tree({ nodeId, depth }: { nodeId: string; depth: number }) {
    const node = project!.workPackages.find((w) => w.id === nodeId)!;
    const kids = childrenOf(nodeId);
    return (
      <div>
        <div className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-surface2" style={{ marginLeft: depth * 16 }}>
          <div className="flex items-center gap-2 text-sm">
            {node.code && <span className="font-mono text-xs text-muted">{node.code}</span>}
            <span>{node.name}</span>
            <Badge className="bg-surface2 text-muted">{WBS_STATUS[node.status] ?? node.status}</Badge>
          </div>
          <span className="text-xs text-muted">{node._count.tasks} tarefas</span>
        </div>
        {kids.map((k) => <Tree key={k.id} nodeId={k.id} depth={depth + 1} />)}
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={project.name}
        description={project.description ?? undefined}
        actions={<LinkButton href={`/board?project=${project.id}`}><KanbanSquare size={16} /> Abrir Kanban</LinkButton>}
      />

      <div className="mb-6 flex items-center gap-2">
        <Badge color={project.color}>{project.key}</Badge>
        <span className="text-sm text-muted">{project._count.tasks} tarefas - {project._count.deliverables} entregaveis - {project._count.requirements} requisitos</span>
      </div>

      <ProjectCockpit
        project={{ id: project.id, key: project.key, name: project.name, color: project.color }}
        activeSprint={
          activeSprint
            ? {
                id: activeSprint.id,
                name: activeSprint.name,
                goal: activeSprint.goal,
                endDate: activeSprint.endDate?.toISOString() ?? null,
              }
            : null
        }
        openTasks={openTasks}
        deliverables={deliverables.map((d) => ({
          id: d.id,
          name: d.name,
          status: d.status,
          dueDate: d.dueDate?.toISOString() ?? null,
        }))}
        articles={articles.map((a) => ({
          id: a.id,
          title: a.title,
          externalSource: a.externalSource,
          updatedAt: a.updatedAt.toISOString(),
        }))}
        threads={threads.map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          updatedAt: t.updatedAt.toISOString(),
        }))}
        linkCount={linkCount}
        seMaturity={{ approved: reqApproved, total: reqTotal }}
        vvPassed={vvPassed}
        vvTotal={vvTotal}
        systemElementCount={systemElementCount}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold">Estrutura de trabalho (WBS)</h2>
          <p className="mb-3 text-xs text-muted">Atividades hierarquicas no estilo da engenharia de sistemas.</p>
          <div className="mb-4 space-y-0.5">
            {roots.length === 0 && <p className="text-sm text-muted">Nenhuma atividade ainda.</p>}
            {roots.map((r) => <Tree key={r.id} nodeId={r.id} depth={0} />)}
          </div>
          {writable && <AddWorkPackageForm projectId={project.id} parents={project.workPackages.map((w) => ({ id: w.id, name: w.name, code: w.code }))} />}
        </Card>

        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold">Equipe</h2>
            <div className="mb-3 space-y-2">
              {project.memberships.map((m) => (
                <div key={m.id} className="flex items-center gap-2">
                  <Avatar name={m.user.name} color={m.user.avatarColor} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{m.user.name}</p>
                    <p className="text-xs text-muted">{m.user.title ?? m.user.role}</p>
                  </div>
                  <Badge className="bg-surface2 text-muted">{m.role}</Badge>
                </div>
              ))}
            </div>
            {writable && <AddMemberForm projectId={project.id} candidates={candidates} />}
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold">Categorias</h2>
            <div className="mb-3 flex flex-wrap gap-2">
              {project.labels.length === 0 && <p className="text-sm text-muted">Nenhuma categoria.</p>}
              {project.labels.map((l) => <Badge key={l.id} color={l.color}>{l.name}</Badge>)}
            </div>
            {writable && <AddLabelForm projectId={project.id} />}
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold">Sprints</h2>
            <div className="space-y-2">
              {project.sprints.length === 0 && <p className="text-sm text-muted">Nenhuma sprint.</p>}
              {project.sprints.map((s) => (
                <Link key={s.id} href="/sprints" className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm hover:bg-surface2">
                  <span>{s.name}</span>
                  <Badge className="bg-surface2 text-muted">{s.status}</Badge>
                </Link>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
