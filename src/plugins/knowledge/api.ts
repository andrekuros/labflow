import { prisma } from "@/lib/db";
import { jsonOk } from "@/plugins/api-utils";
import type { PluginApiHandlers } from "@/plugins/types";
import { searchKnowledge } from "@/plugins/knowledge/actions";
import { syncNextcloudKnowledge } from "@/plugins/knowledge/sync";
import { jsonError } from "@/plugins/api-utils";

export const handlers: PluginApiHandlers = {
  "GET /articles": async () => {
    const rows = await prisma.knowledgeArticle.findMany({
      include: { project: true, author: true },
      orderBy: { updatedAt: "desc" },
    });
    return jsonOk(rows);
  },

  "GET /articles/:id": async ({ params }) => {
    const row = await prisma.knowledgeArticle.findUnique({
      where: { id: params.id },
      include: { author: true, project: true },
    });
    if (!row) return jsonOk(null, 404);
    return jsonOk(row);
  },

  "GET /search": async ({ request }) => {
    const q = new URL(request.url).searchParams.get("q") ?? "";
    const result = await searchKnowledge(q);
    return jsonOk(result);
  },

  "POST /sync-nextcloud": async ({ user }) => {
    if (user.role !== "admin") return jsonError("Sem permissao", 403);
    const result = await syncNextcloudKnowledge(user.id);
    return jsonOk(result);
  },

  "GET /health": async ({ user }) => {
    if (user.role !== "admin") return jsonError("Sem permissao", 403);
    const { computeKnowledgeHealth } = await import("@/plugins/knowledge/health");
    return jsonOk(await computeKnowledgeHealth());
  },
};
