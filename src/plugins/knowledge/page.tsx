import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { viewableProjectIds } from "@/lib/projects";
import { getNextcloudSettingsForUi } from "@/plugins/knowledge/nextcloud-config";
import { buildFolderTree } from "@/plugins/knowledge/folder-tree";
import { computeKnowledgeHealth } from "@/plugins/knowledge/health";
import { PageHeader } from "@/components/ui";
import { KnowledgeClient } from "@/components/knowledge/knowledge-client";

export default async function KnowledgePage() {
  const session = await requireUser();
  const ids = await viewableProjectIds(session);
  const isAdmin = session.role === "admin";

  const [articles, projects, nextcloud, healthReport] = await Promise.all([
    prisma.knowledgeArticle.findMany({
      where: { OR: [{ projectId: null }, { projectId: { in: ids } }] },
      include: { project: true, author: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.project.findMany({ where: { id: { in: ids } }, orderBy: { name: "asc" } }),
    isAdmin ? getNextcloudSettingsForUi() : Promise.resolve(null),
    isAdmin ? computeKnowledgeHealth() : Promise.resolve(null),
  ]);

  const folderTree = buildFolderTree(
    articles.map((a) => ({ externalFolder: a.externalFolder, externalSource: a.externalSource })),
  );

  return (
    <div>
      <PageHeader
        title="Base de conhecimento"
        description="Navegue por pastas do Nextcloud, use templates e alimente o assistente de IA com busca semantica."
      />
      <KnowledgeClient
        isAdmin={isAdmin}
        nextcloud={nextcloud}
        folderTree={folderTree}
        healthReport={healthReport}
        projects={projects.map((p) => ({ id: p.id, key: p.key, name: p.name }))}
        articles={articles.map((a) => ({
          id: a.id,
          title: a.title,
          tags: a.tags,
          updatedAt: a.updatedAt.toISOString(),
          projectKey: a.project?.key ?? null,
          projectColor: a.project?.color ?? null,
          author: a.author?.name ?? (a.externalSource === "nextcloud" ? "Nextcloud" : "Desconhecido"),
          externalSource: a.externalSource,
          externalFolder: a.externalFolder,
          externalStatus: a.externalStatus,
        }))}
      />
    </div>
  );
}
