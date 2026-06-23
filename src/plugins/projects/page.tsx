import Link from "next/link";
import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { viewableProjectIds } from "@/lib/projects";
import { Card, Badge, PageHeader, EmptyState } from "@/components/ui";
import { NewProjectButton } from "@/components/projects/project-forms";

export default async function ProjectsPage() {
  const session = await requireUser();
  const ids = await viewableProjectIds(session);
  const projects = await prisma.project.findMany({
    where: { id: { in: ids } },
    include: {
      _count: { select: { tasks: true, deliverables: true, memberships: true } },
      memberships: { include: { user: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <PageHeader title="Projetos" description="Linhas de pesquisa e iniciativas do laboratorio." actions={<NewProjectButton />} />
      {projects.length === 0 ? (
        <EmptyState title="Nenhum projeto" description="Crie o primeiro projeto do laboratorio." action={<NewProjectButton />} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`}>
              <Card className="h-full p-5 transition hover:border-brand/60">
                <div className="mb-2 flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: p.color }} />
                  <Badge color={p.color}>{p.key}</Badge>
                  {p.status !== "active" && <Badge className="bg-surface2 text-muted">{p.status}</Badge>}
                </div>
                <h3 className="font-semibold">{p.name}</h3>
                {p.description && <p className="mt-1 line-clamp-2 text-sm text-muted">{p.description}</p>}
                <div className="mt-4 flex items-center gap-4 text-xs text-muted">
                  <span>{p._count.tasks} tarefas</span>
                  <span>{p._count.deliverables} entregaveis</span>
                  <span>{p._count.memberships} membros</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
