import "server-only";
import { on } from "@/lib/events";
import { ingest } from "@/lib/ai/rag";
import { registerBuiltinPlugins } from "@/plugins";

/**
 * One-time server bootstrap: subscribes the knowledge/RAG ingestion pipeline to
 * content events, and loads built-in plugins. Idempotent (guarded globally).
 */

const g = globalThis as unknown as { __labflowBootstrapped?: boolean };

export function bootstrap() {
  if (g.__labflowBootstrapped) return;
  g.__labflowBootstrapped = true;

  // Knowledge ingestion: everything discussed/shared accumulates into the RAG store.
  on("article.created", (e) => ingestFromEvent("article", e));
  on("article.updated", (e) => ingestFromEvent("article", e));
  on("post.created", (e) => ingestFromEvent("post", e));
  on("thread.created", (e) => ingestFromEvent("post", e));
  on("task.created", (e) => ingestFromEvent("task", e));
  on("deliverable.created", (e) => ingestFromEvent("deliverable", e));

  registerBuiltinPlugins();
}

async function ingestFromEvent(
  sourceType: "article" | "post" | "comment" | "task" | "deliverable",
  event: { projectId?: string | null; payload?: Record<string, unknown> },
) {
  const payload = event.payload ?? {};
  const id = payload.id as string | undefined;
  const text = [payload.title, payload.content, payload.description]
    .filter(Boolean)
    .join("\n");
  if (!id || !text.trim()) return;
  await ingest({
    sourceType,
    sourceId: id,
    projectId: event.projectId ?? null,
    text,
  });
}
