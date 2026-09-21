import "server-only";
import { localEmbed } from "@/lib/ai/embeddings";
import { getAiConfig, type AiConfig } from "@/lib/ai/config";

/**
 * LLM provider abstraction. Supports OpenAI-compatible APIs and Ollama; falls
 * back to fully-offline behavior when provider is "none".
 * Configuration is read from /settings (assistant plugin) with .env fallback.
 *
 * Contract: when a provider IS configured and the call fails, we throw
 * `AiProviderError` instead of silently degrading. Silent degradation used to
 * hide bad API keys and unreachable Ollama hosts behind plausible-looking
 * offline answers. Callers that want graceful degradation catch explicitly.
 */

export type ToolCall = { id?: string; name: string; arguments: Record<string, unknown> };

export type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  /** Present on an assistant turn that requested tools; replayed back to the model. */
  toolCalls?: ToolCall[];
  /** On a "tool" message: which call this result answers. */
  toolCallId?: string;
  /** On a "tool" message: the tool name (Ollama identifies results by name). */
  name?: string;
};

/** A tool offered to the model, in provider-neutral form. */
export type ToolSpec = {
  name: string;
  description: string;
  parameters: Record<string, { type: string; description?: string }>;
  required?: string[];
};

export type ChatUsage = { promptTokens?: number; completionTokens?: number };

export type ChatResult = { content: string; toolCalls: ToolCall[]; usage?: ChatUsage };

export type ChatOptions = {
  /** Lower = deterministic. Extraction of JSON should stay near 0; prose can go higher. */
  temperature?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
};

export class AiProviderError extends Error {
  readonly provider: string;
  readonly status?: number;
  readonly retryable: boolean;

  constructor(message: string, opts: { provider: string; status?: number; retryable?: boolean; cause?: unknown }) {
    super(message, { cause: opts.cause });
    this.name = "AiProviderError";
    this.provider = opts.provider;
    this.status = opts.status;
    this.retryable = opts.retryable ?? false;
  }
}

const CHAT_TIMEOUT_MS = 60_000;
const EMBED_TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 3;

/** Ollama does not serve OpenAI embedding models; pick a sane local default. */
const OLLAMA_FALLBACK_EMBEDDING_MODEL = "nomic-embed-text";

export type EmbeddingRuntimeStatus = { degraded: boolean; reason?: string };

/**
 * Set when the configured embedding model turns out to be unusable (typically
 * an Ollama model that was never pulled).
 *
 * We then fall back to local hashed vectors so search keeps working, but the
 * degradation is recorded and surfaced in Settings instead of being silent --
 * a search index quietly running at bag-of-words quality is exactly the failure
 * this layer used to hide.
 */
const gEmbed = globalThis as unknown as { __labflowEmbeddingDegraded?: EmbeddingRuntimeStatus };

export function embeddingRuntimeStatus(): EmbeddingRuntimeStatus {
  return gEmbed.__labflowEmbeddingDegraded ?? { degraded: false };
}

export function resetEmbeddingRuntimeStatus() {
  delete gEmbed.__labflowEmbeddingDegraded;
}

function markEmbeddingDegraded(reason: string) {
  if (gEmbed.__labflowEmbeddingDegraded?.degraded) return;
  gEmbed.__labflowEmbeddingDegraded = { degraded: true, reason };
  console.error(`[ai] embeddings degradados para vetores locais: ${reason}`);
}

/** A 404 naming the model means it was never pulled, not an old API surface. */
function isModelMissing(err: unknown): boolean {
  return err instanceof AiProviderError && err.status === 404 && /model/i.test(err.message);
}

export async function aiEnabled() {
  const config = await getAiConfig();
  return config.provider !== "none";
}

function openAiBase(config: AiConfig) {
  return (config.baseUrl || "https://api.openai.com/v1").replace(/\/+$/, "");
}

function ollamaBase(config: AiConfig) {
  return (config.baseUrl || "http://127.0.0.1:11434").replace(/\/+$/, "");
}

/** Embedding model actually used, after provider-specific correction. */
export function resolveEmbeddingModel(config: AiConfig): string {
  if (config.provider === "ollama") {
    // A leftover OpenAI model name would 404 on Ollama.
    if (!config.embeddingModel || /^text-embedding-/.test(config.embeddingModel)) {
      return OLLAMA_FALLBACK_EMBEDDING_MODEL;
    }
    return config.embeddingModel;
  }
  return config.embeddingModel;
}

/**
 * Name recorded on every stored vector, used as the compatibility key for
 * semantic search. Vectors produced by a different model are not comparable.
 */
export async function currentEmbeddingModelName(): Promise<string> {
  if (embeddingRuntimeStatus().degraded) return "local";
  const config = await getAiConfig();
  if (config.provider === "openai" && config.apiKey) return config.embeddingModel;
  if (config.provider === "ollama") return `ollama:${resolveEmbeddingModel(config)}`;
  return "local";
}

function isRetryableStatus(status: number) {
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** fetch + timeout + retry with exponential backoff and jitter. */
async function requestJson(
  url: string,
  init: RequestInit,
  opts: { provider: string; timeoutMs: number; signal?: AbortSignal },
): Promise<unknown> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
    const onAbort = () => controller.abort();
    opts.signal?.addEventListener("abort", onAbort);

    try {
      const res = await fetch(url, { ...init, signal: controller.signal });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        const detail = body.slice(0, 300).replace(/\s+/g, " ").trim();
        const retryable = isRetryableStatus(res.status);
        lastError = new AiProviderError(
          `${opts.provider} respondeu ${res.status}${detail ? `: ${detail}` : ""}`,
          { provider: opts.provider, status: res.status, retryable },
        );
        if (!retryable || attempt === MAX_ATTEMPTS) throw lastError;
      } else {
        return await res.json();
      }
    } catch (err) {
      if (err instanceof AiProviderError) {
        lastError = err;
        if (!err.retryable || attempt === MAX_ATTEMPTS) throw err;
      } else {
        const aborted = opts.signal?.aborted;
        const timedOut = !aborted && (err as Error)?.name === "AbortError";
        lastError = new AiProviderError(
          timedOut
            ? `${opts.provider} nao respondeu em ${Math.round(opts.timeoutMs / 1000)}s`
            : `Falha de rede ao contatar ${opts.provider}: ${(err as Error)?.message ?? "erro desconhecido"}`,
          { provider: opts.provider, retryable: !aborted, cause: err },
        );
        if (aborted || attempt === MAX_ATTEMPTS) throw lastError;
      }
    } finally {
      clearTimeout(timer);
      opts.signal?.removeEventListener("abort", onAbort);
    }

    await sleep(Math.min(2 ** (attempt - 1) * 500, 4000) + Math.random() * 250);
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

/** Embed a batch in one round trip when the provider supports it. */
export async function embedMany(texts: string[], opts: { signal?: AbortSignal } = {}): Promise<number[][]> {
  if (texts.length === 0) return [];
  const config = await getAiConfig();

  if (config.provider === "openai" && config.apiKey) {
    const json = (await requestJson(
      `${openAiBase(config)}/embeddings`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
        body: JSON.stringify({ model: config.embeddingModel, input: texts }),
      },
      { provider: "OpenAI", timeoutMs: EMBED_TIMEOUT_MS, signal: opts.signal },
    )) as { data?: { embedding?: number[]; index?: number }[] };

    const rows = json?.data;
    if (!Array.isArray(rows) || rows.length !== texts.length) {
      throw new AiProviderError("OpenAI devolveu um numero inesperado de embeddings", { provider: "OpenAI" });
    }
    const out: number[][] = new Array(texts.length);
    rows.forEach((row, i) => {
      const vec = row?.embedding;
      if (!Array.isArray(vec)) throw new AiProviderError("OpenAI devolveu embedding invalido", { provider: "OpenAI" });
      out[row.index ?? i] = vec;
    });
    return out;
  }

  if (config.provider === "ollama") {
    const model = resolveEmbeddingModel(config);
    const base = ollamaBase(config);

    // Newer Ollama exposes /api/embed with batch input.
    try {
      const json = (await requestJson(
        `${base}/api/embed`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model, input: texts }),
        },
        { provider: "Ollama", timeoutMs: EMBED_TIMEOUT_MS, signal: opts.signal },
      )) as { embeddings?: number[][] };

      if (Array.isArray(json?.embeddings) && json.embeddings.length === texts.length) {
        gEmbed.__labflowEmbeddingDegraded = { degraded: false };
        return json.embeddings;
      }
    } catch (err) {
      if (isModelMissing(err)) {
        markEmbeddingDegraded(
          `modelo de embedding "${model}" nao esta disponivel no Ollama. Rode: ollama pull ${model}`,
        );
        return texts.map((t) => localEmbed(t));
      }
      // Older builds only expose /api/embeddings (single prompt); anything else is fatal.
      if (!(err instanceof AiProviderError) || err.status !== 404) throw err;
    }

    const out: number[][] = [];
    for (const text of texts) {
      let json: { embedding?: number[] };
      try {
        json = (await requestJson(
          `${base}/api/embeddings`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model, prompt: text }),
          },
          { provider: "Ollama", timeoutMs: EMBED_TIMEOUT_MS, signal: opts.signal },
        )) as { embedding?: number[] };
      } catch (err) {
        if (isModelMissing(err)) {
          markEmbeddingDegraded(
            `modelo de embedding "${model}" nao esta disponivel no Ollama. Rode: ollama pull ${model}`,
          );
          return texts.map((t) => localEmbed(t));
        }
        throw err;
      }

      if (!Array.isArray(json?.embedding)) {
        throw new AiProviderError(`Ollama nao retornou embedding para o modelo "${model}"`, { provider: "Ollama" });
      }
      out.push(json.embedding);
    }
    gEmbed.__labflowEmbeddingDegraded = { degraded: false };
    return out;
  }

  return texts.map((t) => localEmbed(t));
}

export async function embed(text: string, opts: { signal?: AbortSignal } = {}): Promise<number[]> {
  const [vec] = await embedMany([text], opts);
  return vec ?? localEmbed(text);
}

function safeParseArgs(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object") return raw as Record<string, unknown>;
  if (typeof raw !== "string") return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function toolsPayload(tools: ToolSpec[]) {
  return tools.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: { type: "object", properties: t.parameters, required: t.required ?? [] },
    },
  }));
}

function toOpenAiMessages(messages: ChatMessage[]) {
  return messages.map((m) => {
    if (m.role === "tool") {
      return { role: "tool", tool_call_id: m.toolCallId ?? m.name ?? "call", content: m.content };
    }
    if (m.toolCalls?.length) {
      return {
        role: m.role,
        content: m.content || null,
        tool_calls: m.toolCalls.map((c) => ({
          id: c.id ?? c.name,
          type: "function",
          function: { name: c.name, arguments: JSON.stringify(c.arguments) },
        })),
      };
    }
    return { role: m.role, content: m.content };
  });
}

function toOllamaMessages(messages: ChatMessage[]) {
  return messages.map((m) => {
    if (m.role === "tool") return { role: "tool", content: m.content, tool_name: m.name };
    if (m.toolCalls?.length) {
      return {
        role: m.role,
        content: m.content ?? "",
        tool_calls: m.toolCalls.map((c) => ({ function: { name: c.name, arguments: c.arguments } })),
      };
    }
    return { role: m.role, content: m.content };
  });
}

/** Not every local model implements tool calling; Ollama rejects the request outright. */
function isToolsUnsupported(err: unknown): boolean {
  return (
    err instanceof AiProviderError &&
    (err.status === 400 || err.status === 500) &&
    /tool|function/i.test(err.message)
  );
}

/**
 * One chat completion, optionally offering tools.
 *
 * Returns any tool calls the model requested rather than executing them: the
 * caller owns authorization and decides what an assistant is allowed to do.
 */
export async function chatComplete(
  messages: ChatMessage[],
  tools: ToolSpec[] = [],
  opts: ChatOptions = {},
): Promise<ChatResult> {
  const config = await getAiConfig();
  const temperature = opts.temperature ?? 0.2;
  const timeoutMs = opts.timeoutMs ?? CHAT_TIMEOUT_MS;

  if (config.provider === "openai" && !config.apiKey) {
    throw new AiProviderError("Provedor OpenAI selecionado sem chave de API. Configure em Configuracoes > IA.", {
      provider: "OpenAI",
    });
  }

  if (config.provider === "openai") {
    const body: Record<string, unknown> = {
      model: config.chatModel,
      messages: toOpenAiMessages(messages),
      temperature,
    };
    if (tools.length) {
      body.tools = toolsPayload(tools);
      body.tool_choice = "auto";
    }

    const json = (await requestJson(
      `${openAiBase(config)}/chat/completions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
        body: JSON.stringify(body),
      },
      { provider: "OpenAI", timeoutMs, signal: opts.signal },
    )) as {
      choices?: { message?: { content?: string; tool_calls?: { id?: string; function?: { name?: string; arguments?: string } }[] } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    const message = json?.choices?.[0]?.message;
    const toolCalls = (message?.tool_calls ?? [])
      .map((c) => ({ id: c.id, name: c.function?.name ?? "", arguments: safeParseArgs(c.function?.arguments) }))
      .filter((c) => c.name);

    if (typeof message?.content !== "string" && toolCalls.length === 0) {
      throw new AiProviderError("OpenAI devolveu uma resposta sem conteudo", { provider: "OpenAI" });
    }

    return {
      content: message?.content ?? "",
      toolCalls,
      usage: { promptTokens: json?.usage?.prompt_tokens, completionTokens: json?.usage?.completion_tokens },
    };
  }

  if (config.provider === "ollama") {
    const call = async (withTools: boolean) => {
      const body: Record<string, unknown> = {
        model: config.chatModel,
        messages: toOllamaMessages(messages),
        stream: false,
        options: { temperature },
      };
      if (withTools && tools.length) body.tools = toolsPayload(tools);

      return (await requestJson(
        `${ollamaBase(config)}/api/chat`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
        { provider: "Ollama", timeoutMs, signal: opts.signal },
      )) as {
        message?: { content?: string; tool_calls?: { function?: { name?: string; arguments?: unknown } }[] };
        prompt_eval_count?: number;
        eval_count?: number;
      };
    };

    let json: Awaited<ReturnType<typeof call>>;
    try {
      json = await call(tools.length > 0);
    } catch (err) {
      // Model without tool support: answer from context alone rather than fail.
      if (!tools.length || !isToolsUnsupported(err)) throw err;
      console.warn(`[ai] modelo "${config.chatModel}" nao suporta ferramentas; respondendo sem elas`);
      json = await call(false);
    }

    const message = json?.message;
    const toolCalls = (message?.tool_calls ?? [])
      .map((c) => ({ name: c.function?.name ?? "", arguments: safeParseArgs(c.function?.arguments) }))
      .filter((c) => c.name);

    if (typeof message?.content !== "string" && toolCalls.length === 0) {
      throw new AiProviderError(`Ollama devolveu resposta vazia para o modelo "${config.chatModel}"`, {
        provider: "Ollama",
      });
    }

    return {
      content: message?.content ?? "",
      toolCalls,
      usage: { promptTokens: json?.prompt_eval_count, completionTokens: json?.eval_count },
    };
  }

  return { content: offlineAnswer(messages), toolCalls: [] };
}

export async function chat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<string> {
  return (await chatComplete(messages, [], opts)).content;
}

function offlineAnswer(messages: ChatMessage[]): string {
  const question = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const context = messages.find((m) => m.role === "system" && m.content.includes("CONTEXTO"))?.content ?? "";
  const snippets = context
    .split("\n")
    .filter((l) => l.trim().startsWith("- "))
    .slice(0, 4);

  if (snippets.length === 0) {
    return `Nao ha provedor de IA configurado e nao encontrei contexto relevante para: "${question}". Configure o provedor em Configuracoes > Assistente de IA.`;
  }
  return [
    `Resposta baseada no conhecimento acumulado (modo offline, sem LLM):`,
    "",
    ...snippets,
    "",
    `Para respostas mais ricas, configure um provedor de IA em Configuracoes.`,
  ].join("\n");
}
