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

export async function getSettingsData() {
  await requireAdmin();
  await ensurePluginRegistry();
  return listPlugins().map((p) => {
    const settings = { ...p.settings };
    if (p.manifest.id === "assistant" && settings.aiApiKey) {
      settings.aiApiKey = "__MASKED__";
    }
    if (p.manifest.id === "knowledge" && settings.nextcloudAppPassword) {
      settings.nextcloudAppPassword = "__MASKED__";
    }
    return {
      id: p.manifest.id,
      name: p.manifest.name,
      description: p.manifest.description ?? "",
      version: p.manifest.version,
      enabled: p.enabled,
      settings,
      settingsSchema: p.manifest.settingsSchema ?? [],
      requires: p.manifest.requires ?? [],
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

  invalidateAiConfigCache();
  await setPluginSettings("assistant", merged);
  revalidatePath("/settings");
  revalidatePath("/assistant");
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
