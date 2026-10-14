"use server";

import { revalidatePath } from "next/cache";
import { randomBytes, createHash } from "crypto";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/rbac";
import {
  ensurePluginRegistry,
  listPlugins,
  setPluginEnabled,
  setPluginProjectSettings,
  setPluginSettings,
  getPlugin,
} from "@/plugins/registry";
import { getNextcloudSettingsForUi } from "@/plugins/knowledge/nextcloud-config";
import {
  getAiSettingsForUi,
  invalidateAiConfigCache,
  isMaskedApiKey,
} from "@/lib/ai/config";
import { embeddingIndexStats } from "@/lib/ai/rag";
import { reindexAll } from "@/lib/ai/knowledge-indexer";

export async function getSettingsData() {
  await requireAdmin();
  await ensurePluginRegistry();
  return listPlugins().map((p) => {
    // Prefer live manifest so new settingsSchema fields appear without full restart
    const live = getPlugin(p.manifest.id)?.manifest ?? p.manifest;
    const settings = { ...(live.defaultSettings ?? {}), ...p.settings };
    if (live.id === "assistant" && settings.aiApiKey) {
      settings.aiApiKey = "__MASKED__";
    }
    if (live.id === "knowledge" && settings.nextcloudAppPassword) {
      settings.nextcloudAppPassword = "__MASKED__";
    }
    return {
      id: live.id,
      name: live.name,
      description: live.description ?? "",
      version: live.version,
      enabled: p.enabled,
      settings,
      settingsSchema: live.settingsSchema ?? [],
      requires: live.requires ?? [],
      order: p.order,
    };
  });
}

export async function togglePluginAction(pluginId: string, enabled: boolean) {
  await requireAdmin();
  await setPluginEnabled(pluginId, enabled);
  revalidatePath("/settings");
  revalidatePath("/", "layout");
}

export async function savePluginSettingsAction(
  pluginId: string,
  settings: Record<string, unknown>,
) {
  await requireAdmin();

  const next = { ...settings };
  if (pluginId === "assistant") {
    const current = getPlugin("assistant");
    const prevKey = current?.settings.aiApiKey;
    if (!next.aiApiKey || isMaskedApiKey(next.aiApiKey)) {
      if (typeof prevKey === "string" && prevKey) next.aiApiKey = prevKey;
      else delete next.aiApiKey;
    }
    invalidateAiConfigCache();
  }

  if (pluginId === "knowledge") {
    const current = getPlugin("knowledge");
    const prevPw = current?.settings.nextcloudAppPassword;
    if (!next.nextcloudAppPassword || isMaskedApiKey(next.nextcloudAppPassword)) {
      if (typeof prevPw === "string" && prevPw) next.nextcloudAppPassword = prevPw;
      else delete next.nextcloudAppPassword;
    }
  }

  await setPluginSettings(pluginId, next);
  revalidatePath("/settings");
  revalidatePath("/assistant");
  revalidatePath("/knowledge");
}

export async function getAiSettingsAction() {
  await requireAdmin();
  await ensurePluginRegistry();
  return getAiSettingsForUi();
}

export async function saveAiSettingsAction(input: {
  aiProvider: string;
  aiApiKey?: string;
  aiBaseUrl?: string;
  aiChatModel?: string;
  aiEmbeddingModel?: string;
}) {
  await requireAdmin();
  await ensurePluginRegistry();

  const current = getPlugin("assistant");
  const merged: Record<string, unknown> = {
    ...(current?.settings ?? {}),
    aiProvider: input.aiProvider,
    aiBaseUrl: input.aiBaseUrl ?? "",
    aiChatModel: input.aiChatModel ?? "gpt-4o-mini",
    aiEmbeddingModel: input.aiEmbeddingModel ?? "text-embedding-3-small",
  };

  if (input.aiApiKey && !isMaskedApiKey(input.aiApiKey)) {
    merged.aiApiKey = input.aiApiKey;
  }

  await setPluginSettings("assistant", merged);
  // Invalidate after the write: a read racing the update would otherwise
  // repopulate the cache with the old configuration.
  invalidateAiConfigCache();
  revalidatePath("/settings");
  revalidatePath("/assistant");
}

/**
 * Health of the semantic index. `stale` counts vectors produced by a previous
 * embedding model — they are invisible to search until reindexed.
 */
export async function getEmbeddingStatsAction() {
  await requireAdmin();
  await ensurePluginRegistry();
  return embeddingIndexStats();
}

/** Rebuild every embedding with the currently configured model. */
export async function reindexEmbeddingsAction(): Promise<{ error?: string; indexed?: number; failed?: number }> {
  await requireAdmin();
  await ensurePluginRegistry();
  try {
    const result = await reindexAll();
    revalidatePath("/settings");
    revalidatePath("/assistant");
    return result;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Falha ao reindexar" };
  }
}

export async function savePluginProjectSettingsAction(
  pluginId: string,
  projectId: string,
  settings: Record<string, unknown>,
) {
  await requireAdmin();
  await setPluginProjectSettings(pluginId, projectId, settings);
  revalidatePath("/settings");
}

export async function createApiKeyAction(name: string) {
  const session = await requireAdmin();
  const raw = `lf_${randomBytes(32).toString("hex")}`;
  const keyHash = createHash("sha256").update(raw).digest("hex");
  await prisma.apiKey.create({
    data: { userId: session.id, name, keyHash },
  });
  revalidatePath("/settings");
  return raw;
}

export async function deleteApiKeyAction(id: string) {
  await requireAdmin();
  await prisma.apiKey.delete({ where: { id } });
  revalidatePath("/settings");
}

export async function listApiKeysAction() {
  await requireAdmin();
  const keys = await prisma.apiKey.findMany({
    orderBy: { createdAt: "desc" },
    include: { user: { select: { name: true, email: true } } },
  });
  return keys.map((k) => ({
    id: k.id,
    name: k.name,
    createdAt: k.createdAt.toISOString(),
    lastUsed: k.lastUsed?.toISOString() ?? null,
    userName: k.user.name,
  }));
}

export async function getNextcloudSettingsAction() {
  await requireAdmin();
  await ensurePluginRegistry();
  return getNextcloudSettingsForUi();
}

export async function getProjectsForSettingsAction() {
  await requireAdmin();
  const projects = await prisma.project.findMany({
    select: { id: true, key: true, name: true },
    orderBy: { name: "asc" },
  });
  return projects;
}
