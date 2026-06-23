import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { viewableProjectIds, writableMap } from "@/lib/projects";
import { PageHeader } from "@/components/ui";
import { RequirementsView } from "@/components/planning/requirements-view";
import { EmptyState } from "@/components/ui";

export default async function RequirementsPage() {
  const session = await requireUser();
  const ids = await viewableProjectIds(session);
  if (ids.length === 0) {
    return <EmptyState title="Nenhum projeto" description="Participe de um projeto para definir requisitos." />;
  }

  const [projects, requirements, activities, canWrite] = await Promise.all([
    prisma.project.findMany({ where: { id: { in: ids } }, orderBy: { name: "asc" } }),
    prisma.requirement.findMany({
      where: { projectId: { in: ids } },
      include: { project: true, deliverables: true, activities: true },
      orderBy: [{ projectId: "asc" }, { code: "asc" }],
    }),
    prisma.workPackage.findMany({ where: { projectId: { in: ids } } }),
    writableMap(session, ids),
  ]);

  return (
    <div>
      <PageHeader
        title="Requisitos e metas"
        description="Requisitos vinculados a projetos, com rastreabilidade ate atividades e entregaveis."
      />

      <RequirementsView
        projects={projects.map((p) => ({ id: p.id, key: p.key, name: p.name, color: p.color }))}
        requirements={requirements.map((r) => ({
          id: r.id,
          code: r.code,
          title: r.title,
          description: r.description,
          kind: r.kind,
          status: r.status,
          priority: r.priority,
          projectId: r.projectId,
          project: { id: r.project.id, key: r.project.key, name: r.project.name, color: r.project.color },
          activities: r.activities.map((a) => ({ id: a.id, name: a.name, code: a.code })),
          deliverables: r.deliverables.map((d) => ({ id: d.id, name: d.name })),
        }))}
        activities={activities.map((a) => ({
          id: a.id,
          name: a.name,
          code: a.code,
          projectId: a.projectId,
        }))}
        canWrite={canWrite}
      />
    </div>
  );
}
