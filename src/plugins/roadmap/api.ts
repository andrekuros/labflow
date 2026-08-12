import { prisma } from "@/lib/db";
import { jsonError, jsonOk, runApiAction } from "@/plugins/api-utils";
import type { PluginApiHandlers } from "@/plugins/types";
import { createMilestone, setMilestoneStatus } from "@/plugins/roadmap/actions";
import { hasPermission } from "@/lib/rbac";

export const handlers: PluginApiHandlers = {
  "GET milestones": async ({ user, request }) => {
    if (!(await hasPermission(user, "roadmap:view"))) return jsonError("Sem permissao", 403);
    const projectId = new URL(request.url).searchParams.get("projectId");
    const rows = await prisma.milestone.findMany({
      where: projectId ? { projectId } : undefined,
      include: { project: true },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    });
    return jsonOk(rows);
  },

  "POST milestones": async ({ user }, body) => {
    if (!(await hasPermission(user, "roadmap:edit"))) return jsonError("Sem permissao", 403);
    const input = body as {
      projectId?: string;
      name?: string;
      description?: string;
      kind?: string;
      gate?: string | null;
      date?: string | null;
    };
    if (!input?.projectId || !input?.name?.trim()) {
      return jsonError("Campos projectId e name sao obrigatorios");
    }
    return runApiAction(async () => {
      await createMilestone({
        projectId: input.projectId!,
        name: input.name!,
        description: input.description,
        kind: input.kind,
        gate: input.gate,
        date: input.date,
      });
      return { created: true };
    });
  },

  "PATCH milestones/:id": async ({ user, params }, body) => {
    if (!(await hasPermission(user, "roadmap:edit"))) return jsonError("Sem permissao", 403);
    const status = (body as { status?: string } | undefined)?.status;
    if (!status) return jsonError("Campo status e obrigatorio");
    return runApiAction(async () => {
      await setMilestoneStatus(params.id, status);
      return { id: params.id, status };
    });
  },
};
