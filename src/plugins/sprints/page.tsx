import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { workspaceProjectIds } from "@/lib/workspace";
import { writableMap } from "@/lib/projects";
import { Card, Badge, PageHeader, EmptyState } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { AddSprintForm } from "@/components/projects/project-forms";
import { SprintStatusControl } from "@/components/sprints/sprint-controls";

export default async function SprintsPage() {
  const session = await requireUser();
  const ids = await workspaceProjectIds(session);
  if (ids.length === 0) return <EmptyState title="Nenhum projeto" description="Participe de um projeto para gerenciar sprints." />;

  const [projects, sprints, canWrite] = await Promise.all([
    prisma.project.findMany({ where: { id: { in: ids } }, orderBy: { name: "asc" } }),
    prisma.sprint.findMany({
      where: { projectId: { in: ids } },
      include: { project: true, tasks: { select: { status: true } } },
      orderBy: [{ status: "asc" }, { startDate: "desc" }],
    }),
    writableMap(session, ids),
  ]);

  return (
    <div>
      <PageHeader title="Sprints" description="Ciclos de trabalho com metas, prazos e progresso." />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {sprints.length === 0 && <EmptyState title="Nenhuma sprint" description="Crie uma sprint para um dos seus projetos." />}
          {sprints.map((s) => {
            const total = s.tasks.length;
            const done = s.tasks.filter((t) => t.status === "done").length;
            const pct = total ? Math.round((done / total) * 100) : 0;
            return (
              <Card key={s.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge color={s.project.color}>{s.project.key}</Badge>
                      <h3 className="font-semibold">{s.name}</h3>
                    </div>
                    {s.goal && <p className="mt-1 text-sm text-muted">{s.goal}</p>}
                    <p className="mt-1 text-xs text-muted">{formatDate(s.startDate)} - {formatDate(s.endDate)}</p>
                  </div>
                  <SprintStatusControl sprintId={s.id} status={s.status} disabled={!canWrite[s.projectId]} />
                </div>
                <div className="mt-4">
                  <div className="mb-1 flex justify-between text-xs text-muted">
                    <span>{done} de {total} tarefas</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface2">
                    <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        <div className="space-y-3">
          <h2 className="text-sm font-semibold">Nova sprint</h2>
          {projects.filter((p) => canWrite[p.id]).map((p) => (
            <div key={p.id}>
              <p className="mb-1 flex items-center gap-2 text-xs text-muted"><Badge color={p.color}>{p.key}</Badge> {p.name}</p>
              <AddSprintForm projectId={p.id} />
            </div>
          ))}
          {projects.filter((p) => canWrite[p.id]).length === 0 && <p className="text-sm text-muted">Sem permissao de escrita em projetos.</p>}
        </div>
      </div>
    </div>
  );
}
