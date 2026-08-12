import { prisma } from "@/lib/db";
import { jsonError, jsonOk, runApiAction } from "@/plugins/api-utils";
import type { PluginApiHandlers } from "@/plugins/types";
import { createUser, updateUserProfile, deleteUser } from "@/plugins/team/actions";
import { hasPermission } from "@/lib/rbac";

export const handlers: PluginApiHandlers = {
  "GET users": async ({ user }) => {
    if (!(await hasPermission(user, "team:view"))) return jsonError("Sem permissao", 403);
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatarColor: true,
        createdAt: true,
        profiles: { select: { profile: true } },
      },
      orderBy: { name: "asc" },
    });
    return jsonOk(users);
  },

  "GET users/:id": async ({ user, params }) => {
    if (!(await hasPermission(user, "team:view"))) return jsonError("Sem permissao", 403);
    const row = await prisma.user.findUnique({
      where: { id: params.id },
      include: {
        memberships: { include: { project: true } },
        _count: { select: { assignedTasks: true, createdTasks: true } },
      },
    });
    if (!row) return jsonError("Usuario nao encontrado", 404);
    return jsonOk(row);
  },

  "POST users": async ({ user }, body) => {
    if (!(await hasPermission(user, "team:manage"))) return jsonError("Sem permissao", 403);
    const input = body as {
      name?: string;
      email?: string;
      password?: string;
      role?: string;
      profiles?: string[];
    };
    if (!input?.name?.trim() || !input?.email?.trim() || !input?.password || !input?.role) {
      return jsonError("Campos name, email, password e role sao obrigatorios");
    }
    return runApiAction(() =>
      createUser({
        name: input.name!,
        email: input.email!,
        password: input.password!,
        role: input.role!,
        profiles: input.profiles,
      }),
    );
  },

  "PATCH users/:id": async ({ user, params }, body) => {
    if (!(await hasPermission(user, "team:manage"))) return jsonError("Sem permissao", 403);
    const input = (body ?? {}) as {
      role?: string;
      profiles?: string[];
      name?: string;
      email?: string;
      password?: string;
    };
    return runApiAction(async () => {
      await updateUserProfile(params.id, input);
      return { id: params.id, updated: true };
    });
  },

  "DELETE users/:id": async ({ user, params }) => {
    if (!(await hasPermission(user, "team:manage"))) return jsonError("Sem permissao", 403);
    return runApiAction(async () => {
      await deleteUser(params.id);
      return { id: params.id, deleted: true };
    });
  },
};
