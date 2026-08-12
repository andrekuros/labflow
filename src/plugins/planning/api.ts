import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/plugins/api-utils";
import type { PluginApiHandlers } from "@/plugins/types";
import { hasPermission, canViewProject } from "@/lib/rbac";

/** Read-only aggregate of planning entities for a project. */
export const handlers: PluginApiHandlers = {
  "GET": async ({ user, request }) => {
    const projectId = new URL(request.url).searchParams.get("projectId");
    if (!projectId) return jsonError("Query projectId e obrigatoria");

    if (!(await canViewProject(user, projectId))) return jsonError("Sem permissao", 403);

    const canReq = await hasPermission(user, "requirement:view", projectId);
    const canDel = await hasPermission(user, "deliverable:view", projectId);
    const canRoad = await hasPermission(user, "roadmap:view", projectId);
    const canSprint = await hasPermission(user, "sprint:view", projectId);

    const [project, requirements, deliverables, milestones, sprints] = await Promise.all([
      prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true, key: true, name: true, status: true, color: true, kind: true },
      }),
      canReq
        ? prisma.requirement.findMany({
            where: { projectId },
            orderBy: { code: "asc" },
          })
        : Promise.resolve([]),
      canDel
        ? prisma.deliverable.findMany({
            where: { projectId },
            orderBy: { createdAt: "desc" },
          })
        : Promise.resolve([]),
      canRoad
        ? prisma.milestone.findMany({
            where: { projectId },
            orderBy: [{ date: "asc" }, { createdAt: "asc" }],
          })
        : Promise.resolve([]),
      canSprint
        ? prisma.sprint.findMany({
            where: { projectId },
            include: { tasks: { select: { id: true, status: true } } },
            orderBy: [{ status: "asc" }, { startDate: "desc" }],
          })
        : Promise.resolve([]),
    ]);

    if (!project) return jsonError("Projeto nao encontrado", 404);

    return jsonOk({
      project,
      requirements,
      deliverables,
      milestones,
      sprints,
    });
  },
};
