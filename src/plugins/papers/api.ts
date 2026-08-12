import { prisma } from "@/lib/db";
import { jsonError, jsonOk, runApiAction } from "@/plugins/api-utils";
import type { PluginApiHandlers } from "@/plugins/types";
import { createPaperProject } from "@/plugins/papers/actions";
import { hasPermission } from "@/lib/rbac";
import type { PaperStatus } from "@/lib/projects/paper-meta";

export const handlers: PluginApiHandlers = {
  "GET": async ({ user }) => {
    if (!(await hasPermission(user, "papers:view"))) return jsonError("Sem permissao", 403);
    const rows = await prisma.project.findMany({
      where: { kind: "paper" },
      include: {
        _count: { select: { tasks: true, memberships: true } },
        memberships: { include: { user: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });
    return jsonOk(rows);
  },

  "GET :id": async ({ user, params }) => {
    if (!(await hasPermission(user, "papers:view"))) return jsonError("Sem permissao", 403);
    const row = await prisma.project.findFirst({
      where: { id: params.id, kind: "paper" },
      include: {
        workPackages: true,
        milestones: true,
        memberships: { include: { user: true } },
      },
    });
    if (!row) return jsonError("Artigo nao encontrado", 404);
    return jsonOk(row);
  },

  "POST": async ({ user }, body) => {
    if (!(await hasPermission(user, "papers:create"))) return jsonError("Sem permissao", 403);
    const input = body as {
      key?: string;
      name?: string;
      description?: string;
      color?: string;
      status?: PaperStatus;
    };
    if (!input?.key?.trim() || !input?.name?.trim()) {
      return jsonError("Campos key e name sao obrigatorios");
    }
    return runApiAction(() =>
      createPaperProject({
        key: input.key!,
        name: input.name!,
        description: input.description,
        color: input.color,
        status: input.status,
      }),
    );
  },
};
