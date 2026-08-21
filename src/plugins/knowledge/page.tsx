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

const MAX_ARTICLES = 1000;

export default async function KnowledgePage({
  searchParams,
}: {
  searchParams: Promise<{ folder?: string; doc?: string }>;
}) {
  const session = await requireUser();
  await ensurePluginRegistry();
  const { folder, doc } = await searchParams;

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

  const [articles, projects, nextcloud, healthReport, settings] = await Promise.all([
    prisma.knowledgeArticle.findMany({
      where: scopedVisibility,
      include: { project: true, author: true },
      orderBy: { updatedAt: "desc" },
      take: MAX_ARTICLES,
    }),
    prisma.project.findMany({
      where: { id: { in: wsIds } },
      orderBy: { name: "asc" },
    }),
    getNextcloudSettingsForUi(),
    canManage ? computeKnowledgeHealth() : Promise.resolve(null),
    Promise.resolve(getPluginSettings("knowledge")),
  ]);

  const folderTree = buildFolderTree(articles);
  const semanticSearchEnabled = settings.enableSemanticSearch !== false;

  return (
    <div>
      <PageHeader
        title="Biblioteca"
        description="Vault Nextcloud como fonte da verdade: paginas, PDF, DOCX, Excel e PowerPoint organizados por pasta, vinculados ao LabFlow e indexados para a IA."
      />
      <KnowledgeClient
        canCreate={canCreate}
        canManage={canManage}
        semanticSearchEnabled={semanticSearchEnabled}
        nextcloud={nextcloud.enabled ? {
          enabled: true,
          lastSyncAt: nextcloud.lastSyncAt,
          lastSyncMessage: nextcloud.lastSyncMessage,
          lastSyncStatus: nextcloud.lastSyncStatus,
        } : null}
        folderTree={folderTree}
        healthReport={healthReport}
        projects={projects.map((p) => ({ id: p.id, key: p.key, name: p.name, kind: p.kind }))}
        articles={articles.map((a) => ({
          id: a.id,
          title: a.title,
          tags: a.tags,
          updatedAt: a.updatedAt.toISOString(),
          projectKey: a.project?.key ?? null,
          projectColor: a.project?.color ?? null,
          author: a.author?.name ?? (a.externalSource === "nextcloud" ? "Nextcloud" : "Desconhecido"),
          kind: a.kind,
          fileName: a.fileName,
          externalSource: a.externalSource,
          externalFolder: a.externalFolder,
          externalStatus: a.externalStatus,
          adminOnly: articleIsAdminOnly(a, adminFolders),
        }))}
        initialFolder={folder ?? "all"}
        initialDoc={doc ?? null}
        adminOnlyFolders={adminFolders}
      />
    </div>
  );
}
