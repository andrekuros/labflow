import { prisma } from "@/lib/db";
import { jsonError, jsonOk, runApiAction } from "@/plugins/api-utils";
import type { PluginApiHandlers } from "@/plugins/types";
import { createTask, updateTask, deleteTask, moveTask } from "@/plugins/board/actions";
import { hasPermission } from "@/lib/rbac";

export const handlers: PluginApiHandlers = {
  "GET tasks": async ({ user, request }) => {
    if (!(await hasPermission(user, "task:view"))) return jsonError("Sem permissao", 403);
    const projectId = new URL(request.url).searchParams.get("projectId");
    const rows = await prisma.task.findMany({
      where: projectId ? { projectId } : undefined,
      include: { assignees: true, labels: true, project: true },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    });
    return jsonOk(rows);
  },

  "GET tasks/:id": async ({ user, params }) => {
    if (!(await hasPermission(user, "task:view"))) return jsonError("Sem permissao", 403);
    const row = await prisma.task.findUnique({
      where: { id: params.id },
      include: { assignees: true, labels: true, project: true, comments: true },
    });
    if (!row) return jsonError("Tarefa nao encontrada", 404);
    return jsonOk(row);
  },

  "POST tasks": async ({ user }, body) => {
    if (!(await hasPermission(user, "task:create"))) return jsonError("Sem permissao", 403);
    const input = body as {
      projectId?: string;
      title?: string;
      description?: string;
      status?: string;
      priority?: string;
      workPackageId?: string | null;
      estimate?: number | null;
      sprintId?: string | null;
      assigneeIds?: string[];
      labelIds?: string[];
      dueDate?: string | null;
    };
    if (!input?.projectId || !input?.title?.trim()) {
      return jsonError("Campos projectId e title sao obrigatorios");
    }
    return runApiAction(() =>
      createTask({
        projectId: input.projectId!,
        title: input.title!,
        description: input.description,
        status: input.status,
        priority: input.priority,
        workPackageId: input.workPackageId,
        estimate: input.estimate,
        sprintId: input.sprintId,
        assigneeIds: input.assigneeIds,
        labelIds: input.labelIds,
        dueDate: input.dueDate,
      }),
    );
  },

  "PATCH tasks/:id": async ({ user, params }, body) => {
    if (!(await hasPermission(user, "task:edit"))) return jsonError("Sem permissao", 403);
    const input = (body ?? {}) as {
      title?: string;
      description?: string | null;
      priority?: string;
      status?: string;
      order?: number;
      workPackageId?: string | null;
      estimate?: number | null;
      sprintId?: string | null;
      dueDate?: string | null;
      assigneeIds?: string[];
      labelIds?: string[];
    };

    return runApiAction(async () => {
      if (input.status !== undefined && typeof input.order === "number") {
        await moveTask({ taskId: params.id, status: input.status, order: input.order });
      }
      return updateTask({ taskId: params.id, ...input });
    });
  },

  "DELETE tasks/:id": async ({ user, params }) => {
    if (!(await hasPermission(user, "task:delete"))) return jsonError("Sem permissao", 403);
    return runApiAction(async () => {
      await deleteTask(params.id);
      return { id: params.id, deleted: true };
    });
  },
};
