import { prisma } from "@/lib/db";
import { jsonError, jsonOk, runApiAction } from "@/plugins/api-utils";
import type { PluginApiHandlers } from "@/plugins/types";
import { createRequirement, setRequirementStatus } from "@/plugins/requirements/actions";
import { hasPermission } from "@/lib/rbac";

export const handlers: PluginApiHandlers = {
  "GET requirements": async ({ user, request }) => {
    if (!(await hasPermission(user, "requirement:view"))) return jsonError("Sem permissao", 403);
    const projectId = new URL(request.url).searchParams.get("projectId");
    const rows = await prisma.requirement.findMany({
      where: projectId ? { projectId } : undefined,
      include: { project: true, parent: true },
      orderBy: { createdAt: "desc" },
    });
    return jsonOk(rows);
  },

  "GET requirements/:id": async ({ user, params }) => {
    if (!(await hasPermission(user, "requirement:view"))) return jsonError("Sem permissao", 403);
    const row = await prisma.requirement.findUnique({
      where: { id: params.id },
      include: { project: true, children: true, activities: true },
    });
    if (!row) return jsonError("Requisito nao encontrado", 404);
    return jsonOk(row);
  },

  "POST requirements": async ({ user }, body) => {
    if (!(await hasPermission(user, "requirement:create"))) return jsonError("Sem permissao", 403);
    const input = body as {
      projectId?: string;
      title?: string;
      code?: string;
      description?: string;
      kind?: string;
      priority?: string;
      level?: string;
      parentId?: string | null;
      allocatedToId?: string | null;
      source?: string;
      activityIds?: string[];
    };
    if (!input?.projectId || !input?.title?.trim()) {
      return jsonError("Campos projectId e title sao obrigatorios");
    }
    return runApiAction(() =>
      createRequirement({
        projectId: input.projectId!,
        title: input.title!,
        code: input.code,
        description: input.description,
        kind: input.kind,
        priority: input.priority,
        level: input.level,
        parentId: input.parentId,
        allocatedToId: input.allocatedToId,
        source: input.source,
        activityIds: input.activityIds,
      }),
    );
  },

  "PATCH requirements/:id": async ({ user, params }, body) => {
    if (!(await hasPermission(user, "requirement:edit"))) return jsonError("Sem permissao", 403);
    const status = (body as { status?: string } | undefined)?.status;
    if (!status) return jsonError("Campo status e obrigatorio");
    return runApiAction(async () => {
      await setRequirementStatus(params.id, status);
      return { id: params.id, status };
    });
  },
};
