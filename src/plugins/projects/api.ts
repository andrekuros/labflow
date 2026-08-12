import { prisma } from "@/lib/db";
import { jsonError, jsonOk, runApiAction } from "@/plugins/api-utils";
import type { PluginApiHandlers } from "@/plugins/types";
import { createProject, updateProject, deleteProject } from "@/plugins/projects/actions";
import { hasPermission } from "@/lib/rbac";
import type { ProjectKind } from "@/lib/projects/features";

export const handlers: PluginApiHandlers = {
  "GET projects": async ({ user, request }) => {
    if (!(await hasPermission(user, "project:view"))) return jsonError("Sem permissao", 403);
    const kind = new URL(request.url).searchParams.get("kind");
    const rows = await prisma.project.findMany({
      where: kind ? { kind } : undefined,
      include: {
        _count: { select: { tasks: true, deliverables: true, memberships: true } },
        memberships: { include: { user: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return jsonOk(rows);
  },

  "GET projects/:id": async ({ user, params }) => {
    if (!(await hasPermission(user, "project:view", params.id))) return jsonError("Sem permissao", 403);
    const row = await prisma.project.findUnique({
      where: { id: params.id },
      include: {
        workPackages: true,
        labels: true,
        memberships: { include: { user: true } },
        sprints: true,
      },
    });
    if (!row) return jsonError("Projeto nao encontrado", 404);
    return jsonOk(row);
  },

  "POST projects": async ({ user }, body) => {
    if (!(await hasPermission(user, "project:create"))) return jsonError("Sem permissao", 403);
    const input = body as {
      key?: string;
      name?: string;
      description?: string;
      color?: string;
      kind?: ProjectKind;
    };
    if (!input?.key?.trim() || !input?.name?.trim()) {
      return jsonError("Campos key e name sao obrigatorios");
    }
    return runApiAction(() =>
      createProject({
        key: input.key!,
        name: input.name!,
        description: input.description,
        color: input.color,
        kind: input.kind,
      }),
    );
  },

  "PATCH projects/:id": async ({ user, params }, body) => {
    if (!(await hasPermission(user, "project:edit", params.id))) return jsonError("Sem permissao", 403);
    const input = (body ?? {}) as {
      key?: string;
      name?: string;
      description?: string;
      color?: string;
      status?: string;
    };
    return runApiAction(async () => {
      await updateProject(params.id, input);
      return { id: params.id, updated: true };
    });
  },

  "DELETE projects/:id": async ({ user, params }, body) => {
    if (!(await hasPermission(user, "project:delete", params.id))) return jsonError("Sem permissao", 403);
    const confirmKey = (body as { confirmKey?: string } | undefined)?.confirmKey;
    if (!confirmKey) return jsonError("Envie confirmKey (sigla do projeto) no body");
    return runApiAction(async () => {
      await deleteProject(params.id, confirmKey);
      return { id: params.id, deleted: true };
    });
  },
};
