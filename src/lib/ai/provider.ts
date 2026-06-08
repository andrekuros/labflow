import "server-only";
import { localEmbed } from "@/lib/ai/embeddings";

/**
 * LLM provider abstraction. Supports OpenAI-compatible APIs and Ollama; falls
 * back to fully-offline behavior when AI_PROVIDER is "none" (default), so the
 * platform always runs without external dependencies.
 */

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

const provider = (process.env.AI_PROVIDER ?? "none").toLowerCase();
const apiKey = process.env.AI_API_KEY ?? "";
const baseUrl = process.env.AI_BASE_URL ?? "";
const chatModel = process.env.AI_CHAT_MODEL ?? "gpt-4o-mini";
const embeddingModel = process.env.AI_EMBEDDING_MODEL ?? "text-embedding-3-small";

export function aiEnabled() {
  return provider !== "none";
}

export async function embed(text: string): Promise<number[]> {
  if (provider === "openai" && apiKey) {
    try {
      const url = `${baseUrl || "https://api.openai.com/v1"}/embeddings`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model: embeddingModel, input: text }),
      });
      const json = await res.json();
      const vec = json?.data?.[0]?.embedding;
      if (Array.isArray(vec)) return vec;
    } catch (err) {
      console.error("[ai] embedding failed, using local fallback", err);
    }
  }
  return localEmbed(text);
}

export async function chat(messages: ChatMessage[]): Promise<string> {
  if (provider === "openai" && apiKey) {
    try {
      const url = `${baseUrl || "https://api.openai.com/v1"}/chat/completions`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model: chatModel, messages, temperature: 0.2 }),
      });
      const json = await res.json();
      const content = json?.choices?.[0]?.message?.content;
      if (typeof content === "string") return content;
    } catch (err) {
      console.error("[ai] chat failed, using offline fallback", err);
    }
  }
  if (provider === "ollama") {
    try {
      const url = `${baseUrl || "http://localhost:11434"}/api/chat`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: chatModel, messages, stream: false }),
      });
      const json = await res.json();
      const content = json?.message?.content;
      if (typeof content === "string") return content;
    } catch (err) {
      console.error("[ai] ollama chat failed, using offline fallback", err);
    }
  }
  return offlineAnswer(messages);
}

/**
 * Offline heuristic: extractive answer built from the retrieved context that
 * the RAG layer injects as a system message. Keeps the assistant useful with
 * no API key.
 */
function offlineAnswer(messages: ChatMessage[]): string {
  const question = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const context = messages.find((m) => m.role === "system" && m.content.includes("CONTEXTO"))?.content ?? "";
  const snippets = context
    .split("\n")
    .filter((l) => l.trim().startsWith("- "))
    .slice(0, 4);

  if (snippets.length === 0) {
    return `Nao ha provedor de IA configurado e nao encontrei contexto relevante para: "${question}". Configure AI_PROVIDER/AI_API_KEY no .env para respostas geradas por LLM.`;
  }
  return [
    `Resposta baseada no conhecimento acumulado (modo offline, sem LLM):`,
    "",
    ...snippets,
    "",
    `Para respostas mais ricas, configure um provedor de IA no arquivo .env.`,
  ].join("\n");
}
