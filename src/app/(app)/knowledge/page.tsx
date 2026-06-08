import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { viewableProjectIds } from "@/lib/projects";
import { PageHeader } from "@/components/ui";
import { KnowledgeClient } from "@/components/knowledge/knowledge-client";

export default async function KnowledgePage() {
  const session = await requireUser();
  const ids = await viewableProjectIds(session);

  const [articles, projects] = await Promise.all([
    prisma.knowledgeArticle.findMany({
      where: { OR: [{ projectId: null }, { projectId: { in: ids } }] },
      include: { project: true, author: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.project.findMany({ where: { id: { in: ids } }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader
        title="Base de conhecimento"
        description="Wiki do laboratorio com busca semantica. Tudo que e registrado aqui alimenta os agentes de IA."
      />
      <KnowledgeClient
        projects={projects.map((p) => ({ id: p.id, key: p.key, name: p.name }))}
        articles={articles.map((a) => ({
          id: a.id,
          title: a.title,
          tags: a.tags,
          updatedAt: a.updatedAt.toISOString(),
          projectKey: a.project?.key ?? null,
          projectColor: a.project?.color ?? null,
          author: a.author?.name ?? "Desconhecido",
        }))}
      />
    </div>
  );
}
