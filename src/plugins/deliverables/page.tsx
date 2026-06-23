import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { viewableProjectIds, writableMap } from "@/lib/projects";
import { Card, Badge, PageHeader, EmptyState } from "@/components/ui";
import { formatDate, daysUntil } from "@/lib/utils";
import { NewDeliverableButton, DeliverableStatusControl, DELIVERABLE_STATUS } from "@/components/deliverables/deliverable-forms";
import { KnowledgeLinksPanel } from "@/components/knowledge/knowledge-links";

export default async function DeliverablesPage() {
  const session = await requireUser();
  const ids = await viewableProjectIds(session);
  if (ids.length === 0) return <EmptyState title="Nenhum projeto" description="Participe de um projeto para gerenciar entregaveis." />;

  const [projects, deliverables, workPackages, requirements, canWrite] = await Promise.all([
    prisma.project.findMany({ where: { id: { in: ids } }, orderBy: { name: "asc" } }),
    prisma.deliverable.findMany({
      where: { projectId: { in: ids } },
      include: { project: true, workPackage: true, requirements: true },
      orderBy: [{ dueDate: "asc" }],
    }),
    prisma.workPackage.findMany({ where: { projectId: { in: ids } } }),
    prisma.requirement.findMany({ where: { projectId: { in: ids } } }),
    writableMap(session, ids),
  ]);

  const writableProjects = projects.filter((p) => canWrite[p.id]);

  return (
    <div>
      <PageHeader
        title="Entregaveis"
        description="Produtos de cada atividade/projeto, com criterios de aceitacao e prazos."
        actions={
          <NewDeliverableButton
            projects={writableProjects.map((p) => ({ id: p.id, key: p.key, name: p.name }))}
            workPackages={workPackages.map((w) => ({ id: w.id, name: w.name, code: w.code, projectId: w.projectId }))}
            requirements={requirements.map((r) => ({ id: r.id, title: r.title, code: r.code, projectId: r.projectId }))}
          />
        }
      />

      {deliverables.length === 0 ? (
        <EmptyState title="Nenhum entregavel" description="Defina os entregaveis dos seus projetos." />
      ) : (
        <div className="space-y-3">
          {deliverables.map((d) => {
            const days = daysUntil(d.dueDate);
            const st = DELIVERABLE_STATUS[d.status];
            return (
              <Card key={d.id} className="flex flex-wrap items-start justify-between gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge color={d.project.color}>{d.project.key}</Badge>
                    <h3 className="font-medium">{d.name}</h3>
                    {st && <Badge color={st.color}>{st.label}</Badge>}
                  </div>
                  {d.description && <p className="mt-1 text-sm text-muted">{d.description}</p>}
                  {d.acceptance && <p className="mt-1 text-xs text-muted"><span className="font-medium">Aceitacao:</span> {d.acceptance}</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                    {d.workPackage && <span>WBS: {d.workPackage.code ? d.workPackage.code + " " : ""}{d.workPackage.name}</span>}
                    {d.requirements.map((r) => <Badge key={r.id} className="bg-surface2 text-muted">{r.code ?? r.title}</Badge>)}
                  </div>
                  <KnowledgeLinksPanel
                    targetType="deliverable"
                    targetId={d.id}
                    projectId={d.projectId}
                    canEdit={canWrite[d.projectId]}
                    compact
                  />
                </div>
                <div className="flex flex-col items-end gap-2">
                  {d.dueDate && (
                    <span className={`text-xs ${days !== null && days < 0 ? "text-red-400" : days !== null && days <= 7 ? "text-amber-400" : "text-muted"}`}>
                      {formatDate(d.dueDate)}{days !== null && days >= 0 ? ` (${days}d)` : ""}
                    </span>
                  )}
                  <DeliverableStatusControl id={d.id} status={d.status} disabled={!canWrite[d.projectId]} />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
