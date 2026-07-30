import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { workspaceProjectIds } from "@/lib/workspace";
import { writableMap } from "@/lib/projects";
import { PageHeader, EmptyState } from "@/components/ui";
import { SystemModelClient } from "@/components/planning/system-model-client";
import { buildBddDiagram, buildContextDiagram } from "@/lib/se/diagrams";

export default async function SystemModelPage() {
  const session = await requireUser();
  const ids = await workspaceProjectIds(session);
  if (ids.length === 0) return <EmptyState title="Nenhum projeto" description="Participe de um projeto para modelar o sistema." />;

  const [projects, elements, interfaces, canWrite] = await Promise.all([
    prisma.project.findMany({ where: { id: { in: ids } }, orderBy: { name: "asc" } }),
    prisma.systemElement.findMany({ where: { projectId: { in: ids } }, include: { project: true }, orderBy: { order: "asc" } }),
    prisma.interface.findMany({ where: { projectId: { in: ids } }, include: { from: true, to: true } }),
    writableMap(session, ids),
  ]);

  const firstProject = projects[0]?.id;
  const projEls = elements.filter((e) => e.projectId === firstProject);
  const system = projEls.find((e) => e.kind === "system") ?? projEls[0];
  const nodes = projEls.map((e) => ({ id: e.id, name: e.name, kind: e.kind, parentId: e.parentId }));
  const ext = projEls.filter((e) => e.kind === "external");
  const ifaces = interfaces.filter((i) => i.projectId === firstProject).map((i) => ({
    id: i.id, name: i.name, fromName: i.from.name, toName: i.to.name, kind: i.kind,
  }));

  return (
    <div>
      <PageHeader title="Modelo do sistema" description="System of Interest, decomposicao funcional e interfaces (MBSE leve com diagramas mermaid)." />
      <SystemModelClient
        projects={projects.map((p) => ({ id: p.id, key: p.key, name: p.name }))}
        canWrite={canWrite}
        elements={elements.map((e) => ({
          id: e.id, name: e.name, description: e.description, kind: e.kind, parentId: e.parentId,
          projectId: e.projectId, project: { key: e.project.key, color: e.project.color },
        }))}
        interfaces={interfaces.map((i) => ({
          id: i.id, name: i.name, kind: i.kind, protocol: i.protocol, projectId: i.projectId,
          from: { id: i.from.id, name: i.from.name }, to: { id: i.to.id, name: i.to.name },
        }))}
        contextDiagram={system ? buildContextDiagram(system.name, ext.map((e) => ({ id: e.id, name: e.name, kind: e.kind, parentId: e.parentId })), ifaces) : "graph LR\n  SOI[\"System of Interest\"]"}
        bddDiagram={nodes.length ? buildBddDiagram(nodes) : "graph TD\n  SOI[\"Adicione elementos\"]"}
      />
    </div>
  );
}
