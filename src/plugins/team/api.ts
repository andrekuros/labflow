import { prisma } from "@/lib/db";
import { jsonOk } from "@/plugins/api-utils";
import type { PluginApiHandlers } from "@/plugins/types";

export const handlers: PluginApiHandlers = {
  "GET /users": async () => {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        title: true,
        avatarColor: true,
        createdAt: true,
      },
      orderBy: { name: "asc" },
    });
    return jsonOk(users);
  },

  "GET /users/:id": async ({ params }) => {
    const user = await prisma.user.findUnique({
      where: { id: params.id },
      include: {
        memberships: { include: { project: true } },
        _count: { select: { assignedTasks: true, createdTasks: true } },
      },
    });
    if (!user) return jsonOk(null, 404);
    return jsonOk(user);
  },
};
