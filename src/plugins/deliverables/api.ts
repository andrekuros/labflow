import { prisma } from "@/lib/db";
import { jsonError, jsonOk, runApiAction } from "@/plugins/api-utils";
import type { PluginApiHandlers } from "@/plugins/types";
import { createDeliverable, setDeliverableStatus } from "@/plugins/deliverables/actions";
import { hasPermission } from "@/lib/rbac";

export const handlers: PluginApiHandlers = {
  "GET deliverables": async ({ user, request }) => {
    if (!(await hasPermission(user, "deliverable:view"))) return jsonError("Sem permissao", 403);
    const projectId = new URL(request.url).searchParams.get("projectId");
    const rows = await prisma.deliverable.findMany({
      where: projectId ? { projectId } : undefined,
      include: { project: true, requirements: true },
      orderBy: { createdAt: "desc" },
    });
    return jsonOk(rows);
  },

  "GET deliverables/:id": async ({ user, params }) => {
    if (!(await hasPermission(user, "deliverable:view"))) return jsonError("Sem permissao", 403);
    const row = await prisma.deliverable.findUnique({
      where: { id: params.id },
      include: { project: true, requirements: true },
    });
    if (!row) return jsonError("Entregavel nao encontrado", 404);
    return jsonOk(row);
  },

  "POST deliverables": async ({ user }, body) => {
    if (!(await hasPermission(user, "deliverable:create"))) return jsonError("Sem permissao", 403);
    const input = body as {
      projectId?: string;
      name?: string;
      description?: string;
      acceptance?: string;
      dueDate?: string | null;
      workPackageId?: string | null;
      requirementIds?: string[];
    };
    if (!input?.projectId || !input?.name?.trim()) {
      return jsonError("Campos projectId e name sao obrigatorios");
    }
    return runApiAction(() =>
      createDeliverable({
        projectId: input.projectId!,
        name: input.name!,
        description: input.description,
        acceptance: input.acceptance,
        dueDate: input.dueDate,
        workPackageId: input.workPackageId,
        requirementIds: input.requirementIds,
      }),
    );
  },

  "PATCH deliverables/:id": async ({ user, params }, body) => {
    if (!(await hasPermission(user, "deliverable:edit"))) return jsonError("Sem permissao", 403);
    const status = (body as { status?: string } | undefined)?.status;
    if (!status) return jsonError("Campo status e obrigatorio");
    return runApiAction(async () => {
      await setDeliverableStatus(params.id, status);
      return { id: params.id, status };
    });
  },
};
