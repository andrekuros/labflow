import { prisma } from "@/lib/db";
import { jsonError, jsonOk, runApiAction } from "@/plugins/api-utils";
import type { PluginApiHandlers } from "@/plugins/types";
import { createVerificationCase, setVerificationStatus } from "@/plugins/verification/actions";
import { hasPermission } from "@/lib/rbac";

export const handlers: PluginApiHandlers = {
  "GET cases": async ({ user, request }) => {
    if (!(await hasPermission(user, "verification:view"))) return jsonError("Sem permissao", 403);
    const projectId = new URL(request.url).searchParams.get("projectId");
    const rows = await prisma.verificationCase.findMany({
      where: projectId ? { projectId } : undefined,
      include: { requirement: true, milestone: true },
      orderBy: { createdAt: "desc" },
    });
    return jsonOk(rows);
  },

  "POST cases": async ({ user }, body) => {
    if (!(await hasPermission(user, "verification:edit"))) return jsonError("Sem permissao", 403);
    const input = body as {
      projectId?: string;
      requirementId?: string;
      name?: string;
      method?: string;
      milestoneId?: string | null;
    };
    if (!input?.projectId || !input?.requirementId || !input?.name?.trim()) {
      return jsonError("Campos projectId, requirementId e name sao obrigatorios");
    }
    return runApiAction(() =>
      createVerificationCase({
        projectId: input.projectId!,
        requirementId: input.requirementId!,
        name: input.name!,
        method: input.method,
        milestoneId: input.milestoneId,
      }),
    );
  },

  "PATCH cases/:id": async ({ user, params }, body) => {
    if (!(await hasPermission(user, "verification:edit"))) return jsonError("Sem permissao", 403);
    const input = body as { status?: string; result?: string; evidence?: string };
    if (!input?.status) return jsonError("Campo status e obrigatorio");
    return runApiAction(async () => {
      await setVerificationStatus(params.id, input.status!, input.result, input.evidence);
      return { id: params.id, status: input.status };
    });
  },
};
