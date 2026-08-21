import "server-only";
import { prisma } from "@/lib/db";
import { emit } from "@/lib/events";
import { getPluginSettings, setPluginSettings, ensurePluginRegistry } from "@/plugins/registry";
import { getNextcloudSettings } from "@/plugins/knowledge/nextcloud-config";
import { getFileBytes, listLibraryFiles } from "@/plugins/knowledge/nextcloud-client";
import { notifyAdmins } from "@/lib/notifications";
import { parseFrontmatter } from "@/plugins/knowledge/frontmatter";
import {
  isExcludedPath,
  parentFolderFromPath,
  resolveProjectId,
} from "@/plugins/knowledge/folder-map";
import { extractLibraryFile } from "@/lib/knowledge/extract";
import { articleIngestText, kindFromFileName, mimeFromFileName, titleFromFileName } from "@/lib/knowledge/files";

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
  return titleFromFileName(path);
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
    const files = await listLibraryFiles(conn);
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

      const bytes = await getFileBytes(conn, file.path);
      const extracted = await extractLibraryFile(file.name, bytes);
      const kind = kindFromFileName(file.name);
      const fileName = file.name;
      const mimeType = extracted.mimeType || mimeFromFileName(file.name);
      const externalFolder = parentFolderFromPath(file.path);

      let title: string;
      let tags: string;
      let content = "";
      let extractedText = "";
      let externalStatus: string | null = null;
      let projectId: string | null = null;

      if (kind === "page") {
        const raw = bytes.toString("utf8");
        const { meta, body } = parseFrontmatter(raw);
        title = titleFromContent(file.path, body, meta.title);
        tags = mergeTags(file.path, meta.tags);
        content = body.trim() ? body : raw;
        extractedText = body.trim();
        externalStatus = normalizeStatus(meta.status);
        projectId = await resolveProjectId({
          frontmatterProject: meta.project,
          frontmatterProjectId: meta.projectId,
          filePath: file.path,
          folderProjectMap: cfg.folderProjectMap,
        });
      } else {
        title = titleFromFileName(file.path);
        tags = mergeTags(file.path);
        extractedText = extracted.text;
        projectId = await resolveProjectId({
          filePath: file.path,
          folderProjectMap: cfg.folderProjectMap,
        });
      }

      const data = {
        title,
        content,
        tags,
        projectId,
        kind,
        mimeType,
        fileName,
        byteSize: bytes.byteLength,
        extractedText,
        externalSource: "nextcloud" as const,
        externalPath: file.path,
        externalFolder: externalFolder || null,
        externalEtag: file.etag,
        externalStatus,
        externalSyncedAt: now,
      };

      const ingestPayload = articleIngestText({ title, content, extractedText });

      if (existing) {
        const article = await prisma.knowledgeArticle.update({
          where: { id: existing.id },
          data,
        });
        await emit({
          type: "article.updated",
          actorId: actorId ?? null,
          projectId: article.projectId,
          targetId: article.id,
          payload: { id: article.id, title: article.title, content: ingestPayload },
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
          targetId: article.id,
          payload: { id: article.id, title: article.title, content: ingestPayload },
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
        await prisma.knowledgeArticle.delete({ where: { id: article.id } });
        await emit({
          type: "article.deleted",
          actorId: actorId ?? null,
          projectId: article.projectId,
          targetId: article.id,
          payload: { id: article.id, title: article.title },
        });
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
