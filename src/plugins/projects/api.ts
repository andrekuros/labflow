import { prisma } from "@/lib/db";
import { jsonOk } from "@/plugins/api-utils";
import type { PluginApiHandlers } from "@/plugins/types";

export const handlers: PluginApiHandlers = {
  "GET /projects": async () => {
    const rows = await prisma.project.findMany({
      include: {
        _count: { select: { tasks: true, deliverables: true, memberships: true } },
        memberships: { include: { user: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return jsonOk(rows);
  },

  "GET /projects/:id": async ({ params }) => {
    const row = await prisma.project.findUnique({
      where: { id: params.id },
      include: {
        workPackages: true,
        labels: true,
        memberships: { include: { user: true } },
        sprints: true,
      },
    });
    if (!row) return jsonOk(null, 404);
    return jsonOk(row);
  },
};
