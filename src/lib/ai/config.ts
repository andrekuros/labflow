import "server-only";
import { prisma } from "@/lib/db";

export type AiProviderName = "none" | "openai" | "ollama";

export type AiConfig = {
  provider: AiProviderName;
  apiKey: string;
  baseUrl: string;
  chatModel: string;
  embeddingModel: string;
  source: "database" | "env" | "default";
};

const MASK = "__MASKED__";

const g = globalThis as unknown as { __labflowAiConfig?: { value: AiConfig; at: number } };
const TTL_MS = 30_000;

function envDefaults(): AiConfig {
  return {
    provider: (process.env.AI_PROVIDER ?? "none").toLowerCase() as AiProviderName,
    apiKey: process.env.AI_API_KEY ?? "",
    baseUrl: process.env.AI_BASE_URL ?? "",
    chatModel: process.env.AI_CHAT_MODEL ?? "gpt-4o-mini",
    embeddingModel: process.env.AI_EMBEDDING_MODEL ?? "text-embedding-3-small",
    source: process.env.AI_PROVIDER ? "env" : "default",
  };
}

function pickString(db: unknown, env: string, fallback: string): string {
  if (typeof db === "string" && db.trim() !== "") return db.trim();
  if (env.trim() !== "") return env.trim();
  return fallback;
}

function pickProvider(db: unknown, env: string): AiProviderName {
  const raw = pickString(db, env, "none").toLowerCase();
  if (raw === "openai" || raw === "ollama") return raw;
  return "none";
}

export function maskApiKey(key: string): string {
  if (!key) return "";
  return MASK;
}

export function isMaskedApiKey(value: unknown): boolean {
  return value === MASK;
}

export async function getAiConfig(): Promise<AiConfig> {
  const cached = g.__labflowAiConfig;
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;

  const env = envDefaults();
  let stored: Record<string, unknown> = {};

  try {
    const row = await prisma.plugin.findUnique({ where: { pluginId: "assistant" } });
    if (row?.config) stored = JSON.parse(row.config) as Record<string, unknown>;
  } catch {
    // ignore
  }

  const hasDb =
    stored.aiProvider !== undefined ||
    stored.aiApiKey !== undefined ||
    stored.aiBaseUrl !== undefined ||
    stored.aiChatModel !== undefined ||
    stored.aiEmbeddingModel !== undefined;

  const config: AiConfig = {
    provider: pickProvider(stored.aiProvider, env.provider),
    apiKey: pickString(stored.aiApiKey, env.apiKey, ""),
    baseUrl: pickString(stored.aiBaseUrl, env.baseUrl, ""),
    chatModel: pickString(stored.aiChatModel, env.chatModel, "gpt-4o-mini"),
    embeddingModel: pickString(stored.aiEmbeddingModel, env.embeddingModel, "text-embedding-3-small"),
    source: hasDb ? "database" : env.source,
  };

  g.__labflowAiConfig = { value: config, at: Date.now() };
  return config;
}

export function invalidateAiConfigCache() {
  delete g.__labflowAiConfig;
}

/** Settings safe to show in the admin UI (API key masked). */
export async function getAiSettingsForUi() {
  const config = await getAiConfig();
  const row = await prisma.plugin.findUnique({ where: { pluginId: "assistant" } });
  let stored: Record<string, unknown> = {};
  if (row?.config) {
    try {
      stored = JSON.parse(row.config) as Record<string, unknown>;
    } catch {
      // ignore
    }
  }

  return {
    aiProvider: pickProvider(stored.aiProvider, config.provider),
    aiApiKey: config.apiKey ? MASK : "",
    aiBaseUrl: pickString(stored.aiBaseUrl, config.baseUrl, ""),
    aiChatModel: pickString(stored.aiChatModel, config.chatModel, "gpt-4o-mini"),
    aiEmbeddingModel: pickString(stored.aiEmbeddingModel, config.embeddingModel, "text-embedding-3-small"),
    hasStoredKey: Boolean(stored.aiApiKey || config.apiKey),
    configSource: config.source,
  };
}
