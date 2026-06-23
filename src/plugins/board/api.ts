import { prisma } from "@/lib/db";
import { jsonOk } from "@/plugins/api-utils";
import type { PluginApiHandlers } from "@/plugins/types";

export const handlers: PluginApiHandlers = {
  "GET /tasks": async () => {
    const rows = await prisma.task.findMany({
      include: { assignees: true, labels: true, project: true },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    });
    return jsonOk(rows);
  },

  "GET /tasks/:id": async ({ params }) => {
    const row = await prisma.task.findUnique({
      where: { id: params.id },
      include: { assignees: true, labels: true, project: true, comments: true },
    });
    if (!row) return jsonOk(null, 404);
    return jsonOk(row);
  },
};
