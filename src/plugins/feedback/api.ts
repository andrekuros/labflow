import { prisma } from "@/lib/db";
import { jsonError, jsonOk, runApiAction } from "@/plugins/api-utils";
import type { PluginApiHandlers } from "@/plugins/types";
import {
  listFeedbacks,
  submitFeedback,
  updateFeedbackStatus,
  assignFeedback,
  linkFeedbackProject,
  type FeedbackInput,
} from "@/plugins/feedback/actions";
import { hasPermission } from "@/lib/rbac";

export const handlers: PluginApiHandlers = {
  "GET feedbacks": async ({ user }) => {
    if (!(await hasPermission(user, "feedback:view")) && !(await hasPermission(user, "feedback:manage"))) {
      return jsonError("Sem permissao", 403);
    }
    return runApiAction(() => listFeedbacks());
  },

  "GET feedbacks/:id": async ({ user, params }) => {
    if (!(await hasPermission(user, "feedback:view")) && !(await hasPermission(user, "feedback:manage"))) {
      return jsonError("Sem permissao", 403);
    }
    const canManage = await hasPermission(user, "feedback:manage");
    const row = await prisma.feedback.findUnique({
      where: { id: params.id },
      include: {
        submittedBy: { select: { id: true, name: true, email: true } },
        assignee: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, key: true, name: true } },
        comments: {
          orderBy: { createdAt: "asc" },
          include: { author: { select: { id: true, name: true } } },
        },
      },
    });
    if (!row) return jsonError("Feedback nao encontrado", 404);
    if (!canManage && row.submittedById !== user.id) return jsonError("Sem permissao", 403);
    return jsonOk(row);
  },

  "POST feedbacks": async ({ user }, body) => {
    if (!(await hasPermission(user, "feedback:create"))) return jsonError("Sem permissao", 403);
    const input = body as FeedbackInput;
    if (!input?.title?.trim() || !input?.description?.trim() || !input?.category) {
      return jsonError("Campos title, description e category sao obrigatorios");
    }
    return runApiAction(() => submitFeedback(input));
  },

  "PATCH feedbacks/:id": async ({ user, params }, body) => {
    if (!(await hasPermission(user, "feedback:manage"))) return jsonError("Sem permissao", 403);
    const input = (body ?? {}) as {
      status?: string;
      assigneeId?: string | null;
      projectId?: string | null;
    };
    return runApiAction(async () => {
      if (input.status !== undefined) {
        const r = await updateFeedbackStatus(params.id, input.status);
        if (r && "error" in r && r.error) throw new Error(r.error);
      }
      if (input.assigneeId !== undefined) {
        const r = await assignFeedback(params.id, input.assigneeId);
        if (r && "error" in r && r.error) throw new Error(r.error);
      }
      if (input.projectId !== undefined) {
        const r = await linkFeedbackProject(params.id, input.projectId);
        if (r && "error" in r && r.error) throw new Error(r.error);
      }
      return { id: params.id, updated: true };
    });
  },
};
