import { prisma } from "@/lib/db";
import { jsonError, jsonOk, runApiAction } from "@/plugins/api-utils";
import type { PluginApiHandlers } from "@/plugins/types";
import { createSprint, setSprintStatus } from "@/plugins/sprints/actions";
import { hasPermission } from "@/lib/rbac";

export const handlers: PluginApiHandlers = {
  "GET sprints": async ({ user, request }) => {
    if (!(await hasPermission(user, "sprint:view"))) return jsonError("Sem permissao", 403);
    const projectId = new URL(request.url).searchParams.get("projectId");
    const sprints = await prisma.sprint.findMany({
      where: projectId ? { projectId } : undefined,
      include: { project: true, tasks: { select: { id: true, status: true } } },
      orderBy: [{ status: "asc" }, { startDate: "desc" }],
    });
    return jsonOk(sprints);
  },

  "GET sprints/:id": async ({ user, params }) => {
    if (!(await hasPermission(user, "sprint:view"))) return jsonError("Sem permissao", 403);
    const sprint = await prisma.sprint.findUnique({
      where: { id: params.id },
      include: { project: true, tasks: true },
    });
    if (!sprint) return jsonError("Sprint nao encontrada", 404);
    return jsonOk(sprint);
  },

  "POST sprints": async ({ user }, body) => {
    if (!(await hasPermission(user, "sprint:create"))) return jsonError("Sem permissao", 403);
    const input = body as {
      projectId?: string;
      name?: string;
      goal?: string;
      startDate?: string | null;
      endDate?: string | null;
    };
    if (!input?.projectId || !input?.name?.trim()) {
      return jsonError("Campos projectId e name sao obrigatorios");
    }
    return runApiAction(async () => {
      await createSprint({
        projectId: input.projectId!,
        name: input.name!,
        goal: input.goal,
        startDate: input.startDate,
        endDate: input.endDate,
      });
      return { created: true };
    });
  },

  "PATCH sprints/:id": async ({ user, params }, body) => {
    if (!(await hasPermission(user, "sprint:edit"))) return jsonError("Sem permissao", 403);
    const status = (body as { status?: string } | undefined)?.status;
    if (!status) return jsonError("Campo status e obrigatorio");
    return runApiAction(async () => {
      await setSprintStatus(params.id, status);
      return { id: params.id, status };
    });
  },
};
