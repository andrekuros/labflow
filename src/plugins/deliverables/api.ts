import { prisma } from "@/lib/db";
import { jsonOk } from "@/plugins/api-utils";
import type { PluginApiHandlers } from "@/plugins/types";

export const handlers: PluginApiHandlers = {
  "GET /deliverables": async () => {
    const rows = await prisma.deliverable.findMany({
      include: { project: true, workPackage: true, requirements: true },
      orderBy: [{ dueDate: "asc" }],
    });
    return jsonOk(rows);
  },

  "GET /deliverables/:id": async ({ params }) => {
    const row = await prisma.deliverable.findUnique({
      where: { id: params.id },
      include: { project: true, workPackage: true, requirements: true },
    });
    if (!row) return jsonOk(null, 404);
    return jsonOk(row);
  },
};
