import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { viewableProjectIds, writableMap } from "@/lib/projects";
import { PageHeader } from "@/components/ui";
import { RequirementsView } from "@/components/planning/requirements-view";
import { TraceabilityMatrix } from "@/components/planning/traceability-matrix";
import { EmptyState } from "@/components/ui";

export default async function RequirementsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const session = await requireUser();
  const { view } = await searchParams;
  const ids = await viewableProjectIds(session);
  if (ids.length === 0) {
    return <EmptyState title="Nenhum projeto" description="Participe de um projeto para definir requisitos." />;
  }

  const [projects, requirements, activities, systemElements, canWrite] = await Promise.all([
    prisma.project.findMany({ where: { id: { in: ids } }, orderBy: { name: "asc" } }),
    prisma.requirement.findMany({
      where: { projectId: { in: ids } },
      include: {
        project: true,
        deliverables: true,
        activities: true,
        allocatedTo: true,
        verificationCases: true,
        parent: true,
      },
      orderBy: [{ projectId: "asc" }, { level: "asc" }, { code: "asc" }],
    }),
    prisma.workPackage.findMany({ where: { projectId: { in: ids } } }),
    prisma.systemElement.findMany({ where: { projectId: { in: ids } } }),
    writableMap(session, ids),
  ]);

  const mapped = requirements.map((r) => ({
    id: r.id,
    code: r.code,
    title: r.title,
    description: r.description,
    kind: r.kind,
    level: r.level,
    status: r.status,
    priority: r.priority,
    projectId: r.projectId,
    parentId: r.parentId,
    project: { id: r.project.id, key: r.project.key, name: r.project.name, color: r.project.color },
    activities: r.activities.map((a) => ({ id: a.id, name: a.name, code: a.code })),
    deliverables: r.deliverables.map((d) => ({ id: d.id, name: d.name })),
    allocatedTo: r.allocatedTo ? { id: r.allocatedTo.id, name: r.allocatedTo.name } : null,
    verificationCases: r.verificationCases.map((v) => ({ id: v.id, name: v.name, status: v.status })),
  }));

  return (
    <div>
      <PageHeader
        title="Requisitos e metas"
        description="Hierarquia SE (stakeholder → sistema → subsistema) com rastreabilidade e V&V."
      />

      {view === "matrix" && <TraceabilityMatrix requirements={mapped} />}

      <RequirementsView
        projects={projects.map((p) => ({ id: p.id, key: p.key, name: p.name, color: p.color }))}
        requirements={mapped}
        activities={activities.map((a) => ({
          id: a.id,
          name: a.name,
          code: a.code,
          projectId: a.projectId,
        }))}
        systemElements={systemElements.map((e) => ({ id: e.id, name: e.name, projectId: e.projectId }))}
        canWrite={canWrite}
        showMatrixLink
      />
    </div>
  );
}
