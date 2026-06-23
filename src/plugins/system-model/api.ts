import { prisma } from "@/lib/db";
import { jsonOk } from "@/plugins/api-utils";
import type { PluginApiHandlers } from "@/plugins/types";

export const handlers: PluginApiHandlers = {
  "GET /elements": async () => {
    const rows = await prisma.systemElement.findMany({ include: { project: true }, orderBy: { order: "asc" } });
    return jsonOk(rows);
  },

  "GET /interfaces": async () => {
    const rows = await prisma.interface.findMany({ include: { from: true, to: true, project: true } });
    return jsonOk(rows);
  },
};
