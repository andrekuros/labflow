import "server-only";
import { on } from "@/lib/events";
import { ingest } from "@/lib/ai/rag";
import { registerBuiltinPlugins } from "@/plugins";
import { initPluginRegistry } from "@/plugins/registry";
import { indexTask, indexProject, indexUser, indexAcademicProfile, ensureKnowledgeIndexed } from "@/lib/ai/knowledge-indexer";

/**
 * One-time server bootstrap: subscribes the knowledge/RAG ingestion pipeline to
 * content events, and loads built-in plugins. Idempotent (guarded globally).
 */

const g = globalThis as unknown as { __labflowBootstrapped?: boolean };

export function bootstrap() {
  if (g.__labflowBootstrapped) return;
  g.__labflowBootstrapped = true;

  on("article.created", (e) => ingestFromEvent("article", e));
  on("article.updated", (e) => ingestFromEvent("article", e));
  on("post.created", (e) => ingestFromEvent("post", e));
  on("thread.created", (e) => ingestFromEvent("post", e));
  on("task.created", (e) => ingestFromEvent("task", e));
  on("task.updated", (e) => void indexTaskFromEvent(e));
  on("task.moved", (e) => void indexTaskFromEvent(e));
  on("deliverable.created", (e) => ingestFromEvent("deliverable", e));
  on("deliverable.updated", (e) => ingestFromEvent("deliverable", e));
  on("requirement.created", (e) => ingestFromEvent("requirement", e));
  on("project.created", (e) => void indexProjectFromEvent(e));
  on("project.updated", (e) => void indexProjectFromEvent(e));
  on("user.created", (e) => void indexUserFromEvent(e));
  on("user.updated", (e) => void indexUserFromEvent(e));
  on("academic.updated", (e) => void indexAcademicFromEvent(e));

  registerBuiltinPlugins();
}

export async function bootstrapAsync() {
  bootstrap();
  await initPluginRegistry();
  const { startNextcloudAutoSync } = await import("@/plugins/knowledge/auto-sync");
  startNextcloudAutoSync();
  const { startDueDateNotifier } = await import("@/lib/notification-scheduler");
  startDueDateNotifier();
  const { ensureArtifactsFormatArticle } = await import("@/lib/artifacts/ensure-doc");
  await ensureArtifactsFormatArticle();
  void ensureKnowledgeIndexed();
}

async function ingestFromEvent(
  sourceType: "article" | "post" | "comment" | "task" | "deliverable" | "requirement",
  event: { projectId?: string | null; payload?: Record<string, unknown> },
) {
  const payload = event.payload ?? {};
  const id = payload.id as string | undefined;
  const text = [payload.title, payload.content, payload.description, payload.name]
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

async function indexTaskFromEvent(event: { payload?: Record<string, unknown> }) {
  const id = event.payload?.id as string | undefined;
  if (!id) return;
  await indexTask(id);
}

async function indexProjectFromEvent(event: { payload?: Record<string, unknown> }) {
  const id = event.payload?.id as string | undefined;
  if (!id) return;
  await indexProject(id);
}

async function indexUserFromEvent(event: { payload?: Record<string, unknown> }) {
  const id = event.payload?.id as string | undefined;
  if (!id) return;
  await indexUser(id);
}

async function indexAcademicFromEvent(event: { payload?: Record<string, unknown> }) {
  const userId = event.payload?.userId as string | undefined;
  if (!userId) return;
  await indexAcademicProfile(userId);
}
