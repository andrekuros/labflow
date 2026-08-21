import "server-only";
import { prisma } from "@/lib/db";
import { getNextcloudSettings } from "@/plugins/knowledge/nextcloud-config";
import { propfind } from "@/plugins/knowledge/nextcloud-client";
import { parseFrontmatter } from "@/plugins/knowledge/frontmatter";
import { parentFolderFromPath } from "@/plugins/knowledge/folder-map";
import { looksLikeProjectVaultFolder } from "@/lib/knowledge/vault-layout";
import { LIBRARY_FILE_RE } from "@/lib/knowledge/files";

export type HealthIssue = {
  type: "missing_title" | "empty_folder" | "stale" | "no_project" | "draft";
  severity: "info" | "warn";
  message: string;
  path?: string;
  articleId?: string;
};

export type HealthReport = {
  ok: boolean;
  issues: HealthIssue[];
  summary: { missingTitle: number; emptyFolders: number; stale: number; noProject: number; drafts: number };
};

const STALE_DAYS = 90;

function looksLikeFilenameTitle(title: string, path: string): boolean {
  const base = path.split("/").pop()?.replace(LIBRARY_FILE_RE, "") ?? "";
  const normalized = title.toLowerCase().replace(/[-_]/g, " ");
  const baseNorm = base.toLowerCase().replace(/[-_]/g, " ");
  return normalized === baseNorm || title === base;
}

export async function computeKnowledgeHealth(): Promise<HealthReport> {
  const issues: HealthIssue[] = [];
  const cfg = await getNextcloudSettings();

  const articles = await prisma.knowledgeArticle.findMany({
    where: { externalSource: "nextcloud" },
    select: {
      id: true,
      title: true,
      externalPath: true,
      externalFolder: true,
      externalStatus: true,
      projectId: true,
      updatedAt: true,
      content: true,
      kind: true,
    },
  });

  const staleCutoff = Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000;

  for (const a of articles) {
    const path = a.externalPath ?? "";
    const { meta } = parseFrontmatter(a.content);
    const hasHeading = /^#\s+.+/m.test(a.content);
    const title = meta.title ?? a.title;
    const isFile = a.kind === "file" || /\.(pdf|docx)$/i.test(a.externalPath ?? "");

    if (!isFile && !hasHeading && !meta.title && looksLikeFilenameTitle(a.title, path)) {
      issues.push({
        type: "missing_title",
        severity: "warn",
        message: `Sem titulo claro: ${path}`,
        path,
        articleId: a.id,
      });
    }

    if (a.externalStatus === "draft" || meta.status === "draft") {
      issues.push({
        type: "draft",
        severity: "info",
        message: `Rascunho: ${title}`,
        path,
        articleId: a.id,
      });
    }

    if (!a.projectId) {
      const folder = a.externalFolder ?? parentFolderFromPath(path);
      const mapped = folder && cfg.folderProjectMap[folder];
      if (looksLikeProjectVaultFolder(folder) || mapped) {
        issues.push({
          type: "no_project",
          severity: "warn",
          message: `Sem projeto vinculado: ${path}`,
          path,
          articleId: a.id,
        });
      }
    }

    if (a.updatedAt.getTime() < staleCutoff) {
      issues.push({
        type: "stale",
        severity: "info",
        message: `Desatualizado (> ${STALE_DAYS}d): ${title}`,
        path,
        articleId: a.id,
      });
    }
  }

  if (cfg.enabled && cfg.url && cfg.username && cfg.appPassword) {
    try {
      const entries = await propfind(
        { url: cfg.url, username: cfg.username, password: cfg.appPassword, folder: cfg.folder },
        "",
        "infinity",
      );
      const dirs = entries.filter((e) => e.isDirectory && e.path);
      const filesByDir = new Map<string, number>();
      for (const e of entries) {
        if (e.isDirectory || !e.path) continue;
        const parent = parentFolderFromPath(e.path) || "(raiz)";
        filesByDir.set(parent, (filesByDir.get(parent) ?? 0) + 1);
      }
      for (const d of dirs) {
        const key = d.path || "(raiz)";
        if ((filesByDir.get(key) ?? 0) === 0 && !cfg.excludeFolders.some((ex) => key === ex || key.startsWith(`${ex}/`))) {
          issues.push({
            type: "empty_folder",
            severity: "info",
            message: `Pasta vazia no Nextcloud: ${d.path}`,
            path: d.path,
          });
        }
      }
    } catch {
      // connection issues are surfaced elsewhere
    }
  }

  const summary = {
    missingTitle: issues.filter((i) => i.type === "missing_title").length,
    emptyFolders: issues.filter((i) => i.type === "empty_folder").length,
    stale: issues.filter((i) => i.type === "stale").length,
    noProject: issues.filter((i) => i.type === "no_project").length,
    drafts: issues.filter((i) => i.type === "draft").length,
  };

  return { ok: issues.filter((i) => i.severity === "warn").length === 0, issues, summary };
}
