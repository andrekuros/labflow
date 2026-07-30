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

export async function createArticle(input: { title: string; content: string; tags?: string; projectId?: string | null }) {
  const session = await requirePermission("knowledge:create");
  if (input.projectId) {
    const ids = await viewableProjectIds(session);
    if (!ids.includes(input.projectId)) throw new Error("Sem acesso a este projeto.");
  }
  const a = await prisma.knowledgeArticle.create({
    data: {
      title: input.title,
      content: input.content,
      tags: input.tags ?? "",
      projectId: input.projectId || null,
      authorId: session.id,
    },
  });
  await emit({ type: "article.created", actorId: session.id, projectId: a.projectId, targetId: a.id, payload: { id: a.id, title: a.title, content: a.content } });
  revalidatePath("/knowledge");
  return a;
}

export async function updateArticle(input: { id: string; title: string; content: string; tags?: string }) {
  const session = await getSession();
  if (!session) throw new Error("Nao autenticado");
  const existing = await prisma.knowledgeArticle.findUnique({ where: { id: input.id } });
  if (!existing) throw new Error("Artigo nao encontrado");
  if (existing.externalSource === "nextcloud") {
    throw new Error("Artigos sincronizados do Nextcloud sao somente leitura. Edite no vault externo.");
  }
  await assertCanEditArticle(session, existing);
  const a = await prisma.knowledgeArticle.update({
    where: { id: input.id },
    data: { title: input.title, content: input.content, tags: input.tags ?? "" },
  });
  await emit({ type: "article.updated", actorId: session.id, projectId: a.projectId, targetId: a.id, payload: { id: a.id, title: a.title, content: a.content } });
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
        { OR: [{ title: { contains: q } }, { content: { contains: q } }, { tags: { contains: q } }] },
      ],
    },
    take: 10,
  });
  for (const k of keyword) {
    if (!byId.has(k.id)) byId.set(k.id, { score: 0.15, snippet: k.content.slice(0, 160) });
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

  if (result.ok) revalidatePath("/knowledge");
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
