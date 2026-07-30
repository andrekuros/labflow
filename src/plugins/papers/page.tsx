import Link from "next/link";
import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { workspaceProjectIds } from "@/lib/workspace";
import { Card, Badge, PageHeader, EmptyState, LinkButton } from "@/components/ui";
import { NewProjectButton } from "@/components/projects/project-forms";
import { parsePaperMeta, PAPER_STATUS_LABELS, PAPER_STATUS_COLORS, type PaperStatus } from "@/lib/projects/paper-meta";
import { FolderKanban } from "lucide-react";

/** Atalho — fonte da verdade em /projects?kind=paper */
export default async function PapersPage() {
  const session = await requireUser();
  const ids = await workspaceProjectIds(session);
  const projects = await prisma.project.findMany({
    where: { id: { in: ids }, kind: "paper" },
    include: { _count: { select: { tasks: true } } },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div>
      <PageHeader
        title="Artigos"
        description="Atalho para artigos como projetos. A lista completa fica em Projetos."
        actions={
          <div className="flex gap-2">
            <LinkButton href="/projects?kind=paper">
              <FolderKanban size={16} /> Ver em Projetos
            </LinkButton>
            <NewProjectButton defaultKind="paper" />
          </div>
        }
      />

      {projects.length === 0 ? (
        <EmptyState
          title="Nenhum artigo"
          description="Crie um projeto de artigo com pipeline de publicacao."
          action={<NewProjectButton defaultKind="paper" />}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => {
            const paper = parsePaperMeta(p.paperJson);
            return (
              <Link key={p.id} href={`/projects/${p.id}?tab=paper`}>
                <Card className="h-full p-5 transition hover:border-brand/60">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge color={p.color}>{p.key}</Badge>
                    <Badge color={PAPER_STATUS_COLORS[paper.status as PaperStatus]}>
                      {PAPER_STATUS_LABELS[paper.status as PaperStatus]}
                    </Badge>
                  </div>
                  <h3 className="font-semibold">{p.name}</h3>
                  {paper.venue && <p className="mt-1 text-xs text-muted">{paper.venue}</p>}
                  <p className="mt-4 text-xs text-muted">{p._count.tasks} tarefas</p>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
