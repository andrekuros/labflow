import { prisma } from "@/lib/db";
import { jsonError, jsonOk, runApiAction } from "@/plugins/api-utils";
import type { PluginApiHandlers } from "@/plugins/types";
import { createThesisOrDissertation } from "@/plugins/thesis/actions";
import { hasPermission } from "@/lib/rbac";

const THESIS_KINDS = ["thesis", "dissertation"] as const;

export const handlers: PluginApiHandlers = {
  "GET": async ({ user }) => {
    if (!(await hasPermission(user, "thesis:view"))) return jsonError("Sem permissao", 403);
    const rows = await prisma.project.findMany({
      where: { kind: { in: [...THESIS_KINDS] } },
      include: {
        _count: { select: { tasks: true, memberships: true } },
        memberships: { include: { user: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });
    return jsonOk(rows);
  },

  "GET :id": async ({ user, params }) => {
    if (!(await hasPermission(user, "thesis:view"))) return jsonError("Sem permissao", 403);
    const row = await prisma.project.findFirst({
      where: { id: params.id, kind: { in: [...THESIS_KINDS] } },
      include: {
        workPackages: true,
        milestones: true,
        memberships: { include: { user: true } },
      },
    });
    if (!row) return jsonError("Tese/dissertacao nao encontrada", 404);
    return jsonOk(row);
  },

  "POST": async ({ user }, body) => {
    if (!(await hasPermission(user, "thesis:create"))) return jsonError("Sem permissao", 403);
    const input = body as {
      kind?: "thesis" | "dissertation";
      key?: string;
      name?: string;
      description?: string;
      color?: string;
    };
    if (!input?.kind || !THESIS_KINDS.includes(input.kind) || !input.key?.trim() || !input.name?.trim()) {
      return jsonError("Campos kind (thesis|dissertation), key e name sao obrigatorios");
    }
    return runApiAction(() =>
      createThesisOrDissertation({
        kind: input.kind!,
        key: input.key!,
        name: input.name!,
        description: input.description,
        color: input.color,
      }),
    );
  },
};
