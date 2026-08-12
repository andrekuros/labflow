import { prisma } from "@/lib/db";
import { jsonError, jsonOk, runApiAction } from "@/plugins/api-utils";
import type { PluginApiHandlers } from "@/plugins/types";
import {
  createChannel,
  createThread,
  createPost,
  setThreadStatus,
  fetchPosts,
} from "@/plugins/forum/actions";
import { hasPermission } from "@/lib/rbac";

export const handlers: PluginApiHandlers = {
  "GET channels": async ({ user }) => {
    if (!(await hasPermission(user, "forum:view"))) return jsonError("Sem permissao", 403);
    const rows = await prisma.channel.findMany({
      include: { project: true, _count: { select: { threads: true } } },
      orderBy: { createdAt: "asc" },
    });
    return jsonOk(rows);
  },

  "POST channels": async ({ user }, body) => {
    if (!(await hasPermission(user, "forum:create"))) return jsonError("Sem permissao", 403);
    const input = body as { name?: string; description?: string; projectId?: string | null };
    if (!input?.name?.trim()) return jsonError("Campo name e obrigatorio");
    return runApiAction(() =>
      createChannel({
        name: input.name!,
        description: input.description,
        projectId: input.projectId,
      }),
    );
  },

  "POST threads": async ({ user }, body) => {
    if (!(await hasPermission(user, "forum:create"))) return jsonError("Sem permissao", 403);
    const input = body as { channelId?: string; title?: string; content?: string };
    if (!input?.channelId || !input?.title?.trim() || !input?.content?.trim()) {
      return jsonError("Campos channelId, title e content sao obrigatorios");
    }
    return runApiAction(() =>
      createThread({
        channelId: input.channelId!,
        title: input.title!,
        content: input.content!,
      }),
    );
  },

  "GET threads/:id/posts": async ({ user, params }) => {
    if (!(await hasPermission(user, "forum:view"))) return jsonError("Sem permissao", 403);
    return runApiAction(() => fetchPosts(params.id));
  },

  "POST posts": async ({ user }, body) => {
    if (!(await hasPermission(user, "forum:create"))) return jsonError("Sem permissao", 403);
    const input = body as { threadId?: string; content?: string };
    if (!input?.threadId || !input?.content?.trim()) {
      return jsonError("Campos threadId e content sao obrigatorios");
    }
    return runApiAction(() => createPost({ threadId: input.threadId!, content: input.content! }));
  },

  "PATCH threads/:id": async ({ user, params }, body) => {
    if (!(await hasPermission(user, "forum:edit"))) return jsonError("Sem permissao", 403);
    const status = (body as { status?: string } | undefined)?.status;
    if (!status) return jsonError("Campo status e obrigatorio");
    return runApiAction(async () => {
      await setThreadStatus(params.id, status);
      return { id: params.id, status };
    });
  },
};
