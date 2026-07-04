"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requireAdmin } from "@/lib/rbac";
import { emit } from "@/lib/events";
import { search as ragSearch } from "@/lib/ai/rag";
import { ensurePluginRegistry, getPlugin, setPluginSettings } from "@/plugins/registry";
import { syncNextcloudKnowledge } from "@/plugins/knowledge/sync";
import { testNextcloudConnection } from "@/plugins/knowledge/nextcloud-client";
import { getNextcloudSettings, mergeNextcloudPassword, parseFolderProjectMapJson } from "@/plugins/knowledge/nextcloud-config";
import { computeKnowledgeHealth } from "@/plugins/knowledge/health";
import { createNextcloudTemplate, type TemplateKey } from "@/plugins/knowledge/templates";
import { buildFolderTree } from "@/plugins/knowledge/folder-tree";
import type { KnowledgeSearchResult } from "@/plugins/knowledge/types";
import type { HealthReport } from "@/plugins/knowledge/health";

export async function createArticle(input: { title: string; content: string; tags?: string; projectId?: string | null }) {
  const session = await getSession();
  if (!session) throw new Error("Nao autenticado");
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
  const a = await prisma.knowledgeArticle.update({
    where: { id: input.id },
    data: { title: input.title, content: input.content, tags: input.tags ?? "" },
  });
  await emit({ type: "article.updated", actorId: session.id, projectId: a.projectId, targetId: a.id, payload: { id: a.id, title: a.title, content: a.content } });
  revalidatePath("/knowledge");
  return a;
}

export async function searchKnowledge(query: string): Promise<KnowledgeSearchResult> {
  const q = query.trim();
  if (!q) return { articles: [] };

  const hits = await ragSearch(q, { limit: 10 });
  const articleHits = hits.filter((h) => h.sourceType === "article");

  const byId = new Map<string, { score: number; snippet: string }>();
  for (const h of articleHits) {
    const cur = byId.get(h.sourceId);
    if (!cur || h.score > cur.score) byId.set(h.sourceId, { score: h.score, snippet: h.chunk });
  }

  const keyword = await prisma.knowledgeArticle.findMany({
    where: { OR: [{ title: { contains: q } }, { content: { contains: q } }, { tags: { contains: q } }] },
    take: 10,
  });
  for (const k of keyword) {
    if (!byId.has(k.id)) byId.set(k.id, { score: 0.15, snippet: k.content.slice(0, 160) });
  }

  const ids = [...byId.keys()];
  const articles = await prisma.knowledgeArticle.findMany({ where: { id: { in: ids } } });
  const map = new Map(articles.map((a) => [a.id, a]));

  return {
    articles: ids
      .map((id) => {
        const a = map.get(id);
        const meta = byId.get(id)!;
        return a ? { id: a.id, title: a.title, snippet: meta.snippet, score: meta.score } : null;
      })
      .filter(Boolean as unknown as (x: { id: string; title: string; snippet: string; score: number } | null) => x is { id: string; title: string; snippet: string; score: number })
      .sort((a, b) => b.score - a.score),
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
  await getSession();
  const articles = await prisma.knowledgeArticle.findMany({
    select: { externalFolder: true, externalSource: true },
  });
  return buildFolderTree(articles);
}
