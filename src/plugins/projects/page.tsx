import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { workspaceProjectIds, findMyThesisProject } from "@/lib/workspace";
import { ProjectsListClient } from "@/components/projects/projects-list-client";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const session = await requireUser();
  const { kind } = await searchParams;
  const ids = await workspaceProjectIds(session);
  const [projects, myThesis] = await Promise.all([
    prisma.project.findMany({
      where: { id: { in: ids } },
      include: {
        _count: { select: { tasks: true, deliverables: true, memberships: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    findMyThesisProject(session.id),
  ]);

  return (
    <ProjectsListClient
      initialKindFilter={kind ?? "all"}
      myThesisId={myThesis?.id ?? null}
      projects={projects.map((p) => ({
        id: p.id,
        key: p.key,
        name: p.name,
        description: p.description,
        color: p.color,
        kind: p.kind,
        status: p.status,
        taskCount: p._count.tasks,
        deliverableCount: p._count.deliverables,
        memberCount: p._count.memberships,
      }))}
    />
  );
}
