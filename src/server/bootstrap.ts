import "server-only";
import { on } from "@/lib/events";
import { prisma } from "@/lib/db";
import { ingest, purge } from "@/lib/ai/rag";
import { articleIngestText } from "@/lib/knowledge/files";
import { registerBuiltinPlugins } from "@/plugins";
import { initPluginRegistry, ensurePluginRegistry, getPluginSettings } from "@/plugins/registry";
import { indexTask, indexProject, indexUser, indexAcademicProfile, ensureKnowledgeIndexed } from "@/lib/ai/knowledge-indexer";
import { processFeedback } from "@/lib/ai/feedback-agent";

/**
 * One-time server bootstrap: subscribes the knowledge/RAG ingestion pipeline to
 * content events, and loads built-in plugins. Idempotent (guarded globally).
 */

const g = globalThis as unknown as { __labflowBootstrapped?: boolean };

export function bootstrap() {
  if (g.__labflowBootstrapped) return;
  g.__labflowBootstrapped = true;

  on("article.created", (e) => ingestArticleFromEvent(e));
  on("article.updated", (e) => ingestArticleFromEvent(e));
  on("article.deleted", (e) => purgeArticleFromEvent(e));
  on("post.created", (e) => ingestFromEvent("post", e));
  on("thread.created", (e) => ingestFromEvent("post", e));
  on("task.created", (e) => ingestFromEvent("task", e));
  on("task.updated", (e) => void indexTaskFromEvent(e));
  on("task.moved", (e) => void indexTaskFromEvent(e));
  on("deliverable.created", (e) => ingestFromEvent("deliverable", e));
  on("deliverable.updated", (e) => ingestFromEvent("deliverable", e));
  on("requirement.created", (e) => ingestFromEvent("requirement", e));
  on("project.created", (e) => {
    void indexProjectFromEvent(e);
    void ensureVaultFromProjectEvent(e);
  });
  on("project.updated", (e) => void indexProjectFromEvent(e));
  on("user.created", (e) => void indexUserFromEvent(e));
  on("user.updated", (e) => void indexUserFromEvent(e));
  on("academic.updated", (e) => void indexAcademicFromEvent(e));
  on("feedback.submitted", (e) => void processFeedbackFromEvent(e));

  registerBuiltinPlugins();
}

export async function bootstrapAsync() {
  bootstrap();
  // Always refresh manifests so nav label/group changes apply without full restart
  registerBuiltinPlugins();
  await initPluginRegistry();
  const { startNextcloudAutoSync } = await import("@/plugins/knowledge/auto-sync");
  startNextcloudAutoSync();
  const { startDueDateNotifier } = await import("@/lib/notification-scheduler");
  startDueDateNotifier();
  const { startBackupScheduler } = await import("@/lib/backup-scheduler");
  startBackupScheduler();
  const { ensureArtifactsFormatArticle } = await import("@/lib/artifacts/ensure-doc");
  await ensureArtifactsFormatArticle();
  const { ensureProjectBundleFormatArticle } = await import("@/lib/data-transfer/ensure-doc");
  await ensureProjectBundleFormatArticle();
  const { seedPermissions, migrateRoles, migrateUserProfiles } = await import("@/lib/permissions-seed");
  await seedPermissions();
  await migrateUserProfiles();
  await migrateRoles();
  const { migrateAcademicAndPublicationsToProjects } = await import("@/lib/migrate-academic-to-projects");
  await migrateAcademicAndPublicationsToProjects();
  const { ensureAcademicMethodologyArticle } = await import("@/lib/academic/methodology-seed");
  await ensureAcademicMethodologyArticle();
  const { ensureDocArticles } = await import("@/lib/docs-seed");
  void ensureDocArticles();
  void ensureKnowledgeIndexed();
}

async function ingestArticleFromEvent(event: { projectId?: string | null; payload?: Record<string, unknown> }) {
  await ensurePluginRegistry();
  const settings = getPluginSettings("knowledge");
  if (settings.autoIngest === false) return;
  const id = event.payload?.id as string | undefined;
  if (id) {
    const article = await prisma.knowledgeArticle.findUnique({ where: { id } });
    if (article) {
      const text = articleIngestText(article);
      if (!text.trim()) return;
      await ingest({
        sourceType: "article",
        sourceId: article.id,
        projectId: article.projectId,
        text,
      });
      return;
    }
  }
  await ingestFromEvent("article", event);
}

async function purgeArticleFromEvent(event: { targetId?: string | null; payload?: Record<string, unknown> }) {
  const id = (event.targetId ?? event.payload?.id) as string | undefined;
  if (!id) return;
  await purge("article", id);
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

async function ensureVaultFromProjectEvent(event: { projectId?: string | null; payload?: Record<string, unknown> }) {
  const id = (event.projectId ?? event.payload?.id) as string | undefined;
  if (!id) return;
  try {
    const { ensureProjectVaultFromId } = await import("@/lib/knowledge/vault");
    await ensureProjectVaultFromId(id);
  } catch (err) {
    console.error("[knowledge] ensure project vault failed", err);
  }
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

async function processFeedbackFromEvent(event: { payload?: Record<string, unknown> }) {
  const p = event.payload;
  if (!p?.id) return;
  await processFeedback({
    id: p.id as string,
    title: (p.title as string) || "",
    description: (p.description as string) || "",
    category: (p.category as string) || "suggestion",
    platformUrl: p.platformUrl as string | undefined,
  });
}
