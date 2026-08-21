"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requireAdmin, requirePermission } from "@/lib/rbac";
import { viewableProjectIds } from "@/lib/projects";
import {
  assertCanDeleteArticle,
  assertCanEditArticle,
  canViewArticle,
  articleVisibilityWhere,
  getAdminOnlyFolders,
  filterRagHitsForUser,
} from "@/lib/knowledge-access";
import { articleIsAdminOnly } from "@/plugins/knowledge/folder-path";
import { emit } from "@/lib/events";
import { search as ragSearch } from "@/lib/ai/rag";
import { ensurePluginRegistry, getPlugin, setPluginSettings, getPluginSettings } from "@/plugins/registry";
import { syncNextcloudKnowledge } from "@/plugins/knowledge/sync";
import { testNextcloudConnection } from "@/plugins/knowledge/nextcloud-client";
import { getNextcloudSettings, mergeNextcloudPassword, parseFolderProjectMapJson } from "@/plugins/knowledge/nextcloud-config";
import { computeKnowledgeHealth } from "@/plugins/knowledge/health";
import { createNextcloudTemplate, type TemplateKey } from "@/plugins/knowledge/templates";
import { buildFolderTree } from "@/plugins/knowledge/folder-tree";
import type { KnowledgeSearchResult } from "@/plugins/knowledge/types";
import type { HealthReport } from "@/plugins/knowledge/health";
import { parseFrontmatter, serializeFrontmatter } from "@/plugins/knowledge/frontmatter";
import { parentFolderFromPath } from "@/plugins/knowledge/folder-map";
import {
  getVaultConnection,
  normalizeVaultFolder,
  uniqueVaultPath,
  writeVaultMarkdown,
  pageFileName,
  folderForProjectWrite,
  ensureProjectVaultFromId,
} from "@/lib/knowledge/vault";
import { ingestVaultFile } from "@/lib/knowledge/ingest-file";
import {
  articleIngestText,
  LOCAL_VAULT_PREFIX,
} from "@/lib/knowledge/files";
import { askAboutDocument } from "@/lib/ai/agent";

export async function createArticle(input: {
  title: string;
  content: string;
  tags?: string;
  projectId?: string | null;
  folder?: string | null;
}) {
  const session = await requirePermission("knowledge:create");
  if (input.projectId) {
    const ids = await viewableProjectIds(session);
    if (!ids.includes(input.projectId)) throw new Error("Sem acesso a este projeto.");
  }

  const tags = input.tags ?? "";
  const project = input.projectId
    ? await prisma.project.findUnique({ where: { id: input.projectId }, select: { key: true, name: true, kind: true } })
    : null;
  const markdown = serializeFrontmatter(
    {
      title: input.title,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      project: project?.key,
      projectId: input.projectId ?? undefined,
      status: "active",
    },
    input.content,
  );

  const conn = await getVaultConnection();
  let vault: {
    externalSource: string;
    externalPath: string;
    externalFolder: string | null;
    externalEtag: string | null;
    externalSyncedAt: Date;
  } | null = null;

  if (conn) {
    const folder = project
      ? await folderForProjectWrite(conn, project, input.folder)
      : normalizeVaultFolder(input.folder);
    const path = await uniqueVaultPath(folder, pageFileName(input.title));
    const etag = await writeVaultMarkdown(conn, path, markdown);
    vault = {
      externalSource: "nextcloud",
      externalPath: path,
      externalFolder: parentFolderFromPath(path) || null,
      externalEtag: etag,
      externalSyncedAt: new Date(),
    };
  }

  const a = await prisma.knowledgeArticle.create({
    data: {
      title: input.title,
      content: input.content,
      tags,
      projectId: input.projectId || null,
      authorId: session.id,
      kind: "page",
      mimeType: "text/markdown",
      fileName: vault ? pageFileName(input.title) : null,
      extractedText: input.content,
      ...(vault ?? {}),
    },
  });
  await emit({
    type: "article.created",
    actorId: session.id,
    projectId: a.projectId,
    targetId: a.id,
    payload: { id: a.id, title: a.title, content: articleIngestText(a) },
  });
  revalidatePath("/knowledge");
  return a;
}

export async function updateArticle(input: { id: string; title: string; content: string; tags?: string }) {
  const session = await getSession();
  if (!session) throw new Error("Nao autenticado");
  const existing = await prisma.knowledgeArticle.findUnique({ where: { id: input.id } });
  if (!existing) throw new Error("Artigo nao encontrado");
  if (existing.kind === "file") {
    throw new Error("Arquivos binarios nao podem ser editados no LabFlow. Edite no Nextcloud.");
  }
  await assertCanEditArticle(session, existing);

  const tags = input.tags ?? "";
  const project = existing.projectId
    ? await prisma.project.findUnique({ where: { id: existing.projectId }, select: { key: true } })
    : null;
  const markdown = serializeFrontmatter(
    {
      title: input.title,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      project: project?.key,
      projectId: existing.projectId ?? undefined,
      status: existing.externalStatus ?? "active",
    },
    input.content,
  );

  let etag = existing.externalEtag;
  if (existing.externalSource === "nextcloud" && existing.externalPath) {
    const conn = await getVaultConnection();
    if (!conn) throw new Error("Nextcloud nao configurado. Nao e possivel salvar no vault.");
    etag = await writeVaultMarkdown(conn, existing.externalPath, markdown);
  }

  const a = await prisma.knowledgeArticle.update({
    where: { id: input.id },
    data: {
      title: input.title,
      content: input.content,
      tags,
      extractedText: input.content,
      externalEtag: etag,
      externalSyncedAt: existing.externalSource === "nextcloud" ? new Date() : existing.externalSyncedAt,
    },
  });
  await emit({
    type: "article.updated",
    actorId: session.id,
    projectId: a.projectId,
    targetId: a.id,
    payload: { id: a.id, title: a.title, content: articleIngestText(a) },
  });
  revalidatePath("/knowledge");
  revalidatePath(`/knowledge/${input.id}`);
  return a;
}

export async function deleteArticle(id: string) {
  const session = await getSession();
  if (!session) throw new Error("Nao autenticado");
  const existing = await prisma.knowledgeArticle.findUnique({ where: { id } });
  if (!existing) throw new Error("Artigo nao encontrado");
  await assertCanDeleteArticle(session, existing);
  await prisma.knowledgeArticle.delete({ where: { id } });
  await emit({
    type: "article.deleted",
    actorId: session.id,
    projectId: existing.projectId,
    targetId: id,
    payload: { id, title: existing.title },
  });
  revalidatePath("/knowledge");
  revalidatePath(`/knowledge/${id}`);
}

export async function searchKnowledge(query: string): Promise<KnowledgeSearchResult> {
  const session = await getSession();
  if (!session) throw new Error("Nao autenticado");
  await ensurePluginRegistry();
  const settings = getPluginSettings("knowledge");
  const semanticEnabled = settings.enableSemanticSearch !== false;
  const ragScanLimit = Number(settings.ragScanLimit ?? 2000);

  const q = query.trim();
  if (!q) return { articles: [] };

  const visibility = await articleVisibilityWhere(session);
  const byId = new Map<string, { score: number; snippet: string }>();

  if (semanticEnabled) {
    const hits = await filterRagHitsForUser(
      await ragSearch(q, { limit: 10, sourceType: "article", scanLimit: ragScanLimit }),
      session,
    );
    const articleHits = hits.filter((h) => h.sourceType === "article");
    for (const h of articleHits) {
      const cur = byId.get(h.sourceId);
      if (!cur || h.score > cur.score) byId.set(h.sourceId, { score: h.score, snippet: h.chunk });
    }
  }

  const keyword = await prisma.knowledgeArticle.findMany({
    where: {
      AND: [
        visibility,
        { OR: [{ title: { contains: q } }, { content: { contains: q } }, { tags: { contains: q } }, { extractedText: { contains: q } }] },
      ],
    },
    take: 10,
  });
  for (const k of keyword) {
    if (!byId.has(k.id)) byId.set(k.id, { score: 0.15, snippet: (k.extractedText || k.content).slice(0, 160) });
  }

  const ids = [...byId.keys()];
  if (ids.length === 0) return { articles: [] };

  const articles = await prisma.knowledgeArticle.findMany({
    where: { id: { in: ids }, ...visibility },
  });
  const map = new Map(articles.map((a) => [a.id, a]));

  const visible: { id: string; title: string; snippet: string; score: number; adminOnly: boolean }[] = [];
  const adminFolders = getAdminOnlyFolders();
  for (const id of ids) {
    const a = map.get(id);
    if (!a) continue;
    if (!(await canViewArticle(session, a))) continue;
    const meta = byId.get(id)!;
    visible.push({
      id: a.id,
      title: a.title,
      snippet: meta.snippet,
      score: meta.score,
      adminOnly: articleIsAdminOnly(a, adminFolders),
    });
  }

  return {
    articles: visible.sort((a, b) => b.score - a.score),
  };
}

export async function syncNextcloudAction() {
  const session = await requireAdmin();
  await ensurePluginRegistry();
  const result = await syncNextcloudKnowledge(session.id);
  revalidatePath("/knowledge");
  revalidatePath("/settings");
  return result;
}

export async function testNextcloudAction(input: {
  nextcloudUrl: string;
  nextcloudUsername: string;
  nextcloudAppPassword?: string;
  nextcloudFolder: string;
}) {
  await requireAdmin();
  await ensurePluginRegistry();
  const current = getPlugin("knowledge");
  const password =
    mergeNextcloudPassword(input.nextcloudAppPassword, String(current?.settings.nextcloudAppPassword ?? "")) ?? "";

  return testNextcloudConnection({
    url: input.nextcloudUrl,
    username: input.nextcloudUsername,
    password,
    folder: input.nextcloudFolder,
  });
}

export async function saveNextcloudSettingsAction(input: {
  nextcloudEnabled: boolean;
  nextcloudUrl: string;
  nextcloudUsername: string;
  nextcloudAppPassword?: string;
  nextcloudFolder: string;
  nextcloudAutoSyncEnabled?: boolean;
  nextcloudAutoSyncIntervalMinutes?: number;
  nextcloudFolderProjectMapJson?: string;
  nextcloudExcludeFolders?: string;
  nextcloudAdminOnlyFolders?: string;
}) {
  await requireAdmin();
  await ensurePluginRegistry();
  const current = getPlugin("knowledge");
  const merged: Record<string, unknown> = {
    ...(current?.settings ?? {}),
    nextcloudEnabled: input.nextcloudEnabled,
    nextcloudUrl: input.nextcloudUrl.trim(),
    nextcloudUsername: input.nextcloudUsername.trim(),
    nextcloudFolder: input.nextcloudFolder.trim() || "LabFlow",
    nextcloudAutoSyncEnabled: Boolean(input.nextcloudAutoSyncEnabled),
    nextcloudAutoSyncIntervalMinutes: Math.max(5, Number(input.nextcloudAutoSyncIntervalMinutes ?? 60)),
    nextcloudFolderProjectMap: input.nextcloudFolderProjectMapJson
      ? parseFolderProjectMapJson(input.nextcloudFolderProjectMapJson)
      : current?.settings.nextcloudFolderProjectMap ?? {},
    nextcloudExcludeFolders: (input.nextcloudExcludeFolders ?? "templates")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    nextcloudAdminOnlyFolders: (input.nextcloudAdminOnlyFolders ?? "admin")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  };

  const pw = mergeNextcloudPassword(
    input.nextcloudAppPassword,
    String(current?.settings.nextcloudAppPassword ?? ""),
  );
  if (pw) merged.nextcloudAppPassword = pw;

  await setPluginSettings("knowledge", merged);
  revalidatePath("/settings");
  revalidatePath("/knowledge");
}

export async function getKnowledgeHealthAction(): Promise<HealthReport> {
  await requireAdmin();
  await ensurePluginRegistry();
  return computeKnowledgeHealth();
}

export async function createNextcloudTemplateAction(input: {
  templateKey: TemplateKey;
  targetFolder: string;
  title: string;
}) {
  await requireAdmin();
  await ensurePluginRegistry();
  const cfg = await getNextcloudSettings();
  if (!cfg.url || !cfg.username || !cfg.appPassword) {
    return { ok: false, message: "Configure o Nextcloud antes de criar templates." };
  }

  const result = await createNextcloudTemplate(
    { url: cfg.url, username: cfg.username, password: cfg.appPassword, folder: cfg.folder },
    input.templateKey,
    input.targetFolder,
    input.title,
  );

  if (result.ok) {
    await syncNextcloudKnowledge();
    revalidatePath("/knowledge");
  }
  return result;
}

export async function getKnowledgeFolderTreeAction() {
  const session = await getSession();
  if (!session) throw new Error("Nao autenticado");
  const visibility = await articleVisibilityWhere(session);
  const articles = await prisma.knowledgeArticle.findMany({
    where: visibility,
    select: { externalFolder: true, externalSource: true },
  });
  return buildFolderTree(articles);
}

export async function uploadLibraryFileAction(formData: FormData): Promise<{ id: string } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Nao autenticado" };
  try {
    await requirePermission("knowledge:create");
  } catch {
    return { error: "Sem permissao para enviar arquivos." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Selecione um arquivo." };
  const folderRaw = String(formData.get("folder") ?? "");
  const projectIdRaw = String(formData.get("projectId") ?? "").trim();
  const projectId = projectIdRaw || null;
  if (projectId) {
    const ids = await viewableProjectIds(session);
    if (!ids.includes(projectId)) return { error: "Sem acesso a este projeto." };
  }

  const conn = await getVaultConnection();
  if (!conn) return { error: "Nextcloud precisa estar habilitado para enviar arquivos." };

  const projectRow = projectId
    ? await prisma.project.findUnique({ where: { id: projectId }, select: { key: true, name: true, kind: true } })
    : null;
  const folder = projectRow
    ? await folderForProjectWrite(conn, projectRow, folderRaw)
    : normalizeVaultFolder(folderRaw);
  const result = await ingestVaultFile({
    sessionId: session.id,
    fileName: file.name,
    bytes: new Uint8Array(await file.arrayBuffer()),
    folder,
    projectId,
    conn,
  });
  if ("error" in result) return result;
  revalidatePath("/knowledge");
  return { id: result.id };
}

export async function migrateLocalArticlesToVaultAction(): Promise<{ ok: boolean; migrated: number; message: string }> {
  const session = await requireAdmin();
  const conn = await getVaultConnection();
  if (!conn) return { ok: false, migrated: 0, message: "Nextcloud nao configurado." };

  const locals = await prisma.knowledgeArticle.findMany({
    where: {
      OR: [{ externalSource: null }, { externalSource: { notIn: ["nextcloud", "system"] } }],
      kind: "page",
    },
  });

  let migrated = 0;
  for (const article of locals) {
    if (article.externalPath) continue;
    const project = article.projectId
      ? await prisma.project.findUnique({ where: { id: article.projectId }, select: { key: true, name: true, kind: true } })
      : null;
    const folder = project
      ? await folderForProjectWrite(conn, project)
      : LOCAL_VAULT_PREFIX;
    const path = await uniqueVaultPath(folder, pageFileName(article.title));
    const markdown = serializeFrontmatter(
      {
        title: article.title,
        tags: article.tags.split(",").map((t) => t.trim()).filter(Boolean),
        project: project?.key,
        projectId: article.projectId ?? undefined,
        status: "active",
      },
      article.content,
    );
    const etag = await writeVaultMarkdown(conn, path, markdown);
    await prisma.knowledgeArticle.update({
      where: { id: article.id },
      data: {
        externalSource: "nextcloud",
        externalPath: path,
        externalFolder: parentFolderFromPath(path) || null,
        externalEtag: etag,
        externalSyncedAt: new Date(),
        fileName: pageFileName(article.title),
        mimeType: "text/markdown",
        extractedText: article.extractedText || article.content,
      },
    });
    migrated++;
  }

  revalidatePath("/knowledge");
  return { ok: true, migrated, message: `${migrated} artigo(s) enviados ao vault.` };
}

export async function ensureMissingProjectVaultsAction(): Promise<{
  ok: boolean;
  ensured: number;
  message: string;
}> {
  await requireAdmin();
  const conn = await getVaultConnection();
  if (!conn) return { ok: false, ensured: 0, message: "Nextcloud nao configurado." };

  const projects = await prisma.project.findMany({
    select: { id: true, key: true, name: true, kind: true },
    orderBy: { key: "asc" },
  });
  let ensured = 0;
  const errors: string[] = [];
  for (const project of projects) {
    try {
      await ensureProjectVaultFromId(project.id);
      ensured++;
    } catch (err) {
      errors.push(`${project.key}: ${err instanceof Error ? err.message : "falha"}`);
    }
  }
  revalidatePath("/knowledge");
  const extra = errors.length ? ` Falhas: ${errors.slice(0, 3).join("; ")}` : "";
  return { ok: errors.length === 0, ensured, message: `Pastas criadas/verificadas para ${ensured} projeto(s).${extra}` };
}

export async function askAboutArticleAction(articleId: string, question: string) {
  const session = await getSession();
  if (!session) throw new Error("Nao autenticado");
  const article = await prisma.knowledgeArticle.findUnique({ where: { id: articleId } });
  if (!article || !(await canViewArticle(session, article))) {
    throw new Error("Artigo nao encontrado ou sem acesso.");
  }
  return askAboutDocument(article, question, session);
}

export async function getLibraryArticleAction(id: string) {
  const session = await getSession();
  if (!session) throw new Error("Nao autenticado");
  const article = await prisma.knowledgeArticle.findUnique({
    where: { id },
    include: { project: true, author: true },
  });
  if (!article || !(await canViewArticle(session, article))) {
    throw new Error("Artigo nao encontrado ou sem acesso.");
  }
  return {
    id: article.id,
    title: article.title,
    content: article.content,
    extractedText: article.extractedText.slice(0, 4000),
    tags: article.tags,
    kind: article.kind,
    mimeType: article.mimeType,
    fileName: article.fileName,
    byteSize: article.byteSize,
    projectKey: article.project?.key ?? null,
    projectColor: article.project?.color ?? null,
    author: article.author?.name ?? (article.externalSource === "nextcloud" ? "Nextcloud" : "Desconhecido"),
    updatedAt: article.updatedAt.toISOString(),
    externalSource: article.externalSource,
    externalPath: article.externalPath,
    externalFolder: article.externalFolder,
    indexed: Boolean((article.extractedText || article.content).trim()),
  };
}
