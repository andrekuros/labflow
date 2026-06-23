import { prisma } from "@/lib/db";
import { jsonOk } from "@/plugins/api-utils";
import type { PluginApiHandlers } from "@/plugins/types";

export const handlers: PluginApiHandlers = {
  "GET /sprints": async () => {
    const sprints = await prisma.sprint.findMany({
      include: { project: true, tasks: { select: { id: true, status: true } } },
      orderBy: [{ status: "asc" }, { startDate: "desc" }],
    });
    return jsonOk(sprints);
  },

  "GET /sprints/:id": async ({ params }) => {
    const sprint = await prisma.sprint.findUnique({
      where: { id: params.id },
      include: { project: true, tasks: true },
    });
    if (!sprint) return jsonOk(null, 404);
    return jsonOk(sprint);
  },
};
