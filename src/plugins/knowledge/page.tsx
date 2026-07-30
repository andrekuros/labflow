import { requireUser, hasPermission } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { articleVisibilityWhere } from "@/lib/knowledge-access";
import { getAdminOnlyFolders } from "@/lib/knowledge-access";
import { articleIsAdminOnly } from "@/plugins/knowledge/folder-path";
import { workspaceProjectIds } from "@/lib/workspace";
import { getNextcloudSettingsForUi } from "@/plugins/knowledge/nextcloud-config";
import { buildFolderTree } from "@/plugins/knowledge/folder-tree";
import { computeKnowledgeHealth } from "@/plugins/knowledge/health";
import { ensurePluginRegistry, getPluginSettings } from "@/plugins/registry";
import { PageHeader } from "@/components/ui";
import { KnowledgeClient } from "@/components/knowledge/knowledge-client";

const PAGE_SIZE = 30;

export default async function KnowledgePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; folder?: string }>;
}) {
  const session = await requireUser();
  await ensurePluginRegistry();
  const { page: pageParam, folder } = await searchParams;
  const page = Math.max(1, Number(pageParam ?? 1) || 1);

  const [canCreate, canManage] = await Promise.all([
    hasPermission(session, "knowledge:create"),
    hasPermission(session, "knowledge:edit"),
  ]);

  const visibility = await articleVisibilityWhere(session);
  const wsIds = await workspaceProjectIds(session);
  const scopedVisibility = {
    AND: [
      visibility,
      { OR: [{ projectId: null }, { projectId: { in: wsIds } }] },
    ],
  };
  const adminFolders = getAdminOnlyFolders();

  const [totalCount, articles, projects, nextcloud, healthReport, settings] = await Promise.all([
    prisma.knowledgeArticle.count({ where: scopedVisibility }),
    prisma.knowledgeArticle.findMany({
      where: scopedVisibility,
      include: { project: true, author: true },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.project.findMany({
      where: { id: { in: wsIds } },
      orderBy: { name: "asc" },
    }),
    canManage ? getNextcloudSettingsForUi() : Promise.resolve(null),
    canManage ? computeKnowledgeHealth() : Promise.resolve(null),
    Promise.resolve(getPluginSettings("knowledge")),
  ]);

  const allForTree = await prisma.knowledgeArticle.findMany({
    where: visibility,
    select: { externalFolder: true, externalSource: true },
  });
  const folderTree = buildFolderTree(allForTree);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const semanticSearchEnabled = settings.enableSemanticSearch !== false;

  return (
    <div>
      <PageHeader
        title="Base de conhecimento"
        description="Navegue por pastas do Nextcloud, use templates e alimente o assistente de IA com busca semantica."
      />
      <KnowledgeClient
        canCreate={canCreate}
        canManage={canManage}
        semanticSearchEnabled={semanticSearchEnabled}
        nextcloud={nextcloud?.enabled ? {
          enabled: true,
          lastSyncAt: nextcloud.lastSyncAt,
          lastSyncMessage: nextcloud.lastSyncMessage,
          lastSyncStatus: nextcloud.lastSyncStatus,
        } : null}
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
          adminOnly: articleIsAdminOnly(a, adminFolders),
        }))}
        pagination={{ page, totalPages, totalCount, pageSize: PAGE_SIZE }}
        initialFolder={folder ?? "all"}
        adminOnlyFolders={adminFolders}
      />
    </div>
  );
}
