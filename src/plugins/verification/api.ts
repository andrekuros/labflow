import { prisma } from "@/lib/db";
import { jsonOk } from "@/plugins/api-utils";
import type { PluginApiHandlers } from "@/plugins/types";

export const handlers: PluginApiHandlers = {
  "GET /cases": async () => {
    const rows = await prisma.verificationCase.findMany({
      include: { requirement: true, milestone: true, project: true },
      orderBy: { updatedAt: "desc" },
    });
    return jsonOk(rows);
  },
};
