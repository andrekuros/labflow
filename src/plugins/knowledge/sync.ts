import "server-only";
import { prisma } from "@/lib/db";
import { emit } from "@/lib/events";
import { getPluginSettings, setPluginSettings, ensurePluginRegistry } from "@/plugins/registry";
import { getNextcloudSettings } from "@/plugins/knowledge/nextcloud-config";
import { getFile, listMarkdownFiles } from "@/plugins/knowledge/nextcloud-client";
import { notifyAdmins } from "@/lib/notifications";
import { parseFrontmatter } from "@/plugins/knowledge/frontmatter";
import {
  isExcludedPath,
  parentFolderFromPath,
  resolveProjectId,
} from "@/plugins/knowledge/folder-map";

export type SyncResult = {
  ok: boolean;
  created: number;
  updated: number;
  skipped: number;
  removed: number;
  message: string;
};

function titleFromContent(path: string, body: string, metaTitle?: string): string {
  if (metaTitle?.trim()) return metaTitle.trim();
  const heading = body.match(/^#\s+(.+)$/m);
  if (heading?.[1]) return heading[1].trim();
  const base = path.split("/").pop() ?? path;
  return base.replace(/\.(md|txt)$/i, "").replace(/[-_]/g, " ");
}

function mergeTags(path: string, metaTags?: string[]): string {
  const fromPath = parentFolderFromPath(path);
  const parts = fromPath ? fromPath.split("/") : [];
  const base = ["nextcloud", ...parts];
  const all = [...base, ...(metaTags ?? [])].map((t) => t.trim().toLowerCase()).filter(Boolean);
  return [...new Set(all)].join(",");
}

function normalizeStatus(status?: string): string | null {
  if (!status) return null;
  const s = status.toLowerCase();
  if (s === "draft" || s === "active" || s === "archived") return s;
  return null;
}

export async function syncNextcloudKnowledge(actorId?: string): Promise<SyncResult> {
  await ensurePluginRegistry();
  const cfg = await getNextcloudSettings();

  if (!cfg.enabled) {
    return { ok: false, created: 0, updated: 0, skipped: 0, removed: 0, message: "Nextcloud desabilitado nas configuracoes." };
  }
  if (!cfg.url || !cfg.username || !cfg.appPassword) {
    return { ok: false, created: 0, updated: 0, skipped: 0, removed: 0, message: "Preencha URL, usuario e senha de app do Nextcloud." };
  }

  const conn = {
    url: cfg.url,
    username: cfg.username,
    password: cfg.appPassword,
    folder: cfg.folder,
  };

  let created = 0;
  let updated = 0;
  let skipped = 0;

  try {
    const files = await listMarkdownFiles(conn);
    const seenPaths = new Set<string>();
    const now = new Date();

    for (const file of files) {
      if (isExcludedPath(file.path, cfg.excludeFolders)) {
        skipped++;
        continue;
      }

      seenPaths.add(file.path);
      const existing = await prisma.knowledgeArticle.findUnique({
        where: { externalPath: file.path },
      });

      if (existing && existing.externalEtag === file.etag) {
        skipped++;
        continue;
      }

      const raw = await getFile(conn, file.path);
      const { meta, body } = parseFrontmatter(raw);
      const title = titleFromContent(file.path, body, meta.title);
      const tags = mergeTags(file.path, meta.tags);
      const externalFolder = parentFolderFromPath(file.path);
      const externalStatus = normalizeStatus(meta.status);
      const projectId = await resolveProjectId({
        frontmatterProject: meta.project,
        frontmatterProjectId: meta.projectId,
        filePath: file.path,
        folderProjectMap: cfg.folderProjectMap,
      });

      const content = body.trim() ? body : raw;
      const data = {
        title,
        content,
        tags,
        projectId,
        externalSource: "nextcloud" as const,
        externalPath: file.path,
        externalFolder: externalFolder || null,
        externalEtag: file.etag,
        externalStatus,
        externalSyncedAt: now,
      };

      if (existing) {
        const article = await prisma.knowledgeArticle.update({
          where: { id: existing.id },
          data,
        });
        await emit({
          type: "article.updated",
          actorId: actorId ?? null,
          projectId: article.projectId,
          payload: { id: article.id, title: article.title, content: article.content },
        });
        updated++;
      } else {
        const article = await prisma.knowledgeArticle.create({
          data: { ...data, authorId: actorId ?? null },
        });
        await emit({
          type: "article.created",
          actorId: actorId ?? null,
          projectId: article.projectId,
          payload: { id: article.id, title: article.title, content: article.content },
        });
        created++;
      }
    }

    const stale = await prisma.knowledgeArticle.findMany({
      where: { externalSource: "nextcloud", externalPath: { not: null } },
    });

    let removed = 0;
    for (const article of stale) {
      if (article.externalPath && !seenPaths.has(article.externalPath)) {
        await prisma.embedding.deleteMany({ where: { sourceType: "article", sourceId: article.id } });
        await prisma.knowledgeArticle.delete({ where: { id: article.id } });
        removed++;
      }
    }

    const message = `Sync concluido: ${created} novos, ${updated} atualizados, ${skipped} sem alteracao, ${removed} removidos.`;
    const current = getPluginSettings("knowledge");
    await setPluginSettings("knowledge", {
      ...current,
      nextcloudLastSyncAt: now.toISOString(),
      nextcloudLastSyncStatus: "ok",
      nextcloudLastSyncMessage: message,
      nextcloudLastSyncCount: created + updated,
    });

    return { ok: true, created, updated, skipped, removed, message };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido no sync";
    const current = getPluginSettings("knowledge");
    await setPluginSettings("knowledge", {
      ...current,
      nextcloudLastSyncAt: new Date().toISOString(),
      nextcloudLastSyncStatus: "error",
      nextcloudLastSyncMessage: message,
      nextcloudLastSyncCount: 0,
    });
    await notifyAdmins({
      kind: "sync_error",
      title: "Sync Nextcloud falhou",
      message,
      href: "/settings",
    });
    return { ok: false, created, updated, skipped, removed: 0, message };
  }
}
