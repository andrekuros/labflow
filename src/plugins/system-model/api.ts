import { prisma } from "@/lib/db";
import { jsonError, jsonOk, runApiAction } from "@/plugins/api-utils";
import type { PluginApiHandlers } from "@/plugins/types";
import {
  createSystemElement,
  createInterface,
  updateSystemDiagram,
} from "@/plugins/system-model/actions";
import { hasPermission } from "@/lib/rbac";

export const handlers: PluginApiHandlers = {
  "GET elements": async ({ user, request }) => {
    if (!(await hasPermission(user, "system_model:view"))) return jsonError("Sem permissao", 403);
    const projectId = new URL(request.url).searchParams.get("projectId");
    const rows = await prisma.systemElement.findMany({
      where: projectId ? { projectId } : undefined,
      orderBy: [{ order: "asc" }, { name: "asc" }],
    });
    return jsonOk(rows);
  },

  "POST elements": async ({ user }, body) => {
    if (!(await hasPermission(user, "system_model:edit"))) return jsonError("Sem permissao", 403);
    const input = body as {
      projectId?: string;
      name?: string;
      description?: string;
      kind?: string;
      parentId?: string | null;
    };
    if (!input?.projectId || !input?.name?.trim()) {
      return jsonError("Campos projectId e name sao obrigatorios");
    }
    return runApiAction(() =>
      createSystemElement({
        projectId: input.projectId!,
        name: input.name!,
        description: input.description,
        kind: input.kind,
        parentId: input.parentId,
      }),
    );
  },

  "GET interfaces": async ({ user, request }) => {
    if (!(await hasPermission(user, "system_model:view"))) return jsonError("Sem permissao", 403);
    const projectId = new URL(request.url).searchParams.get("projectId");
    const rows = await prisma.interface.findMany({
      where: projectId ? { projectId } : undefined,
      include: { from: true, to: true },
    });
    return jsonOk(rows);
  },

  "POST interfaces": async ({ user }, body) => {
    if (!(await hasPermission(user, "system_model:edit"))) return jsonError("Sem permissao", 403);
    const input = body as {
      projectId?: string;
      fromId?: string;
      toId?: string;
      name?: string;
      description?: string;
      kind?: string;
      protocol?: string;
    };
    if (!input?.projectId || !input?.fromId || !input?.toId || !input?.name?.trim()) {
      return jsonError("Campos projectId, fromId, toId e name sao obrigatorios");
    }
    return runApiAction(() =>
      createInterface({
        projectId: input.projectId!,
        fromId: input.fromId!,
        toId: input.toId!,
        name: input.name!,
        description: input.description,
        kind: input.kind,
        protocol: input.protocol,
      }),
    );
  },

  "PATCH diagrams/:id": async ({ user, params }, body) => {
    if (!(await hasPermission(user, "system_model:edit"))) return jsonError("Sem permissao", 403);
    const diagram = (body as { diagram?: string } | undefined)?.diagram;
    if (diagram === undefined) return jsonError("Campo diagram e obrigatorio");
    return runApiAction(async () => {
      await updateSystemDiagram(params.id, diagram);
      return { id: params.id, updated: true };
    });
  },
};
