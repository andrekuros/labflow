import { prisma } from "@/lib/db";
import { jsonError, jsonOk, runApiAction } from "@/plugins/api-utils";
import type { PluginApiHandlers } from "@/plugins/types";
import {
  createArticle,
  updateArticle,
  deleteArticle,
  searchKnowledge,
} from "@/plugins/knowledge/actions";
import { syncNextcloudKnowledge } from "@/plugins/knowledge/sync";
import { isAdminUser } from "@/lib/user-access";
import { articleVisibilityWhere, canViewArticle } from "@/lib/knowledge-access";
import { hasPermission } from "@/lib/rbac";

export const handlers: PluginApiHandlers = {
  "GET articles": async ({ user }) => {
    if (!(await hasPermission(user, "knowledge:view"))) return jsonError("Sem permissao", 403);
    const visibility = await articleVisibilityWhere(user);
    const rows = await prisma.knowledgeArticle.findMany({
      where: visibility,
      include: { project: true, author: true },
      orderBy: { updatedAt: "desc" },
    });
    return jsonOk(rows);
  },

  "GET articles/:id": async ({ params, user }) => {
    if (!(await hasPermission(user, "knowledge:view"))) return jsonError("Sem permissao", 403);
    const row = await prisma.knowledgeArticle.findUnique({
      where: { id: params.id },
      include: { author: true, project: true },
    });
    if (!row) return jsonError("Artigo nao encontrado", 404);
    if (!(await canViewArticle(user, row))) return jsonError("Sem permissao", 403);
    return jsonOk(row);
  },

  "POST articles": async ({ user }, body) => {
    if (!(await hasPermission(user, "knowledge:create"))) return jsonError("Sem permissao", 403);
    const input = body as { title?: string; content?: string; tags?: string; projectId?: string | null };
    if (!input?.title?.trim() || input.content === undefined) {
      return jsonError("Campos title e content sao obrigatorios");
    }
    return runApiAction(() =>
      createArticle({
        title: input.title!,
        content: input.content!,
        tags: input.tags,
        projectId: input.projectId,
      }),
    );
  },

  "PATCH articles/:id": async ({ user, params }, body) => {
    if (!(await hasPermission(user, "knowledge:edit"))) return jsonError("Sem permissao", 403);
    const input = body as { title?: string; content?: string; tags?: string };
    if (!input?.title?.trim() || input.content === undefined) {
      return jsonError("Campos title e content sao obrigatorios");
    }
    return runApiAction(() =>
      updateArticle({
        id: params.id,
        title: input.title!,
        content: input.content!,
        tags: input.tags,
      }),
    );
  },

  "DELETE articles/:id": async ({ user, params }) => {
    if (!(await hasPermission(user, "knowledge:delete"))) return jsonError("Sem permissao", 403);
    return runApiAction(async () => {
      await deleteArticle(params.id);
      return { id: params.id, deleted: true };
    });
  },

  "GET search": async ({ request, user }) => {
    if (!(await hasPermission(user, "knowledge:view"))) return jsonError("Sem permissao", 403);
    const q = new URL(request.url).searchParams.get("q") ?? "";
    return runApiAction(() => searchKnowledge(q));
  },

  "POST sync-nextcloud": async ({ user }) => {
    if (!isAdminUser(user)) return jsonError("Sem permissao", 403);
    return runApiAction(() => syncNextcloudKnowledge(user.id));
  },

  "GET health": async ({ user }) => {
    if (!isAdminUser(user)) return jsonError("Sem permissao", 403);
    const { computeKnowledgeHealth } = await import("@/plugins/knowledge/health");
    return jsonOk(await computeKnowledgeHealth());
  },
};
