import Link from "next/link";
import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { workspaceProjectIds, findMyThesisProject } from "@/lib/workspace";
import { Card, Badge, PageHeader, EmptyState, LinkButton } from "@/components/ui";
import { NewProjectButton } from "@/components/projects/project-forms";
import { PROJECT_KIND_LABELS } from "@/lib/projects/features";
import { FolderKanban } from "lucide-react";

/** Atalho de listagem — a fonte da verdade e /projects?kind=… */
export default async function ThesisPage() {
  const session = await requireUser();
  const ids = await workspaceProjectIds(session);
  const [projects, myThesis] = await Promise.all([
    prisma.project.findMany({
      where: { id: { in: ids }, kind: { in: ["thesis", "dissertation"] } },
      include: { _count: { select: { tasks: true } } },
      orderBy: { updatedAt: "desc" },
    }),
    findMyThesisProject(session.id),
  ]);

  return (
    <div>
      <PageHeader
        title="Teses e dissertacoes"
        description="Atalho para trabalhos de pos-graduacao. A lista completa fica em Projetos."
        actions={
          <div className="flex gap-2">
            <LinkButton href="/projects?kind=academic">
              <FolderKanban size={16} /> Ver em Projetos
            </LinkButton>
            <NewProjectButton defaultKind="dissertation" />
          </div>
        }
      />

      {myThesis && (
        <Link
          href={`/projects/${myThesis.id}`}
          className="mb-4 flex items-center gap-2 rounded-lg border border-brand/30 bg-brand/5 px-3 py-2 text-sm hover:bg-brand/10"
        >
          <span className="font-medium text-brand">Minha tese / dissertacao</span>
          <span className="text-muted">— {myThesis.key} {myThesis.name}</span>
        </Link>
      )}

      {projects.length === 0 ? (
        <EmptyState
          title="Nenhum trabalho"
          description="Crie uma tese ou dissertacao como projeto."
          action={<NewProjectButton defaultKind="thesis" />}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`}>
              <Card className="h-full p-5 transition hover:border-brand/60">
                <div className="mb-2 flex items-center gap-2">
                  <Badge color={p.color}>{p.key}</Badge>
                  <Badge className="bg-surface2 text-muted">
                    {PROJECT_KIND_LABELS[p.kind as "thesis" | "dissertation"]}
                  </Badge>
                </div>
                <h3 className="font-semibold">{p.name}</h3>
                <p className="mt-4 text-xs text-muted">{p._count.tasks} tarefas</p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
