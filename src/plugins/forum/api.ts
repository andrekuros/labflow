import { prisma } from "@/lib/db";
import { jsonOk } from "@/plugins/api-utils";
import type { PluginApiHandlers } from "@/plugins/types";
import { fetchPosts } from "@/plugins/forum/actions";

export const handlers: PluginApiHandlers = {
  "GET /channels": async () => {
    const rows = await prisma.channel.findMany({
      include: { project: true, _count: { select: { threads: true } } },
      orderBy: { createdAt: "asc" },
    });
    return jsonOk(rows);
  },

  "GET /threads/:id/posts": async ({ params }) => {
    const posts = await fetchPosts(params.id);
    return jsonOk(posts);
  },
};
