import { jsonError, runApiAction } from "@/plugins/api-utils";
import type { PluginApiHandlers } from "@/plugins/types";
import { hasPermission } from "@/lib/rbac";
import { resolveWorkspaceScope } from "@/lib/workspace";
import { getGanttData } from "@/lib/gantt";

export const handlers: PluginApiHandlers = {
  /**
   * GET /api/v1/gantt/timeline
   *   ?project=<id>       restrict to one project (must be inside the caller's scope)
   *   &includeDone=false  drop finished work
   *   &scope=all          ignore the workspace filter (needs project:view)
   */
  "GET timeline": async ({ user, request }) => {
    if (!(await hasPermission(user, "project:view"))) return jsonError("Sem permissao", 403);

    const sp = new URL(request.url).searchParams;
    const scope = await resolveWorkspaceScope(user);
    let projectIds = sp.get("scope") === "all" ? scope.visibleProjectIds : scope.projectIds;

    const single = sp.get("project");
    if (single) {
      if (!projectIds.includes(single)) return jsonError("Projeto fora do contexto atual", 404);
      projectIds = [single];
    }

    const durationRaw = Number(sp.get("inferredDurationDays"));
    return runApiAction(() =>
      getGanttData({
        projectIds,
        includeDone: sp.get("includeDone") !== "false",
        inferredDurationDays: Number.isFinite(durationRaw) && durationRaw > 0 ? durationRaw : undefined,
      }),
    );
  },
};
