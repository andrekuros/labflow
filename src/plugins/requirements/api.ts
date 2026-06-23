import { prisma } from "@/lib/db";
import { jsonOk } from "@/plugins/api-utils";
import type { PluginApiHandlers } from "@/plugins/types";

export const handlers: PluginApiHandlers = {
  "GET /requirements": async () => {
    const rows = await prisma.requirement.findMany({
      include: { project: true, deliverables: true, activities: true },
      orderBy: [{ projectId: "asc" }, { code: "asc" }],
    });
    return jsonOk(rows);
  },

  "GET /requirements/:id": async ({ params }) => {
    const row = await prisma.requirement.findUnique({
      where: { id: params.id },
      include: { project: true, deliverables: true, activities: true },
    });
    if (!row) return jsonOk(null, 404);
    return jsonOk(row);
  },
};
