import { prisma } from "@/lib/db";
import { jsonOk } from "@/plugins/api-utils";
import type { PluginApiHandlers } from "@/plugins/types";

export const handlers: PluginApiHandlers = {
  "GET /milestones": async () => {
    const rows = await prisma.milestone.findMany({
      include: { project: true },
      orderBy: { date: "asc" },
    });
    return jsonOk(rows);
  },
};
