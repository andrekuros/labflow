import { jsonError, runApiAction } from "@/plugins/api-utils";
import type { PluginApiHandlers } from "@/plugins/types";
import { queryActivityLog, listActivityFilterOptions } from "@/plugins/activity-log/actions";
import { hasPermission } from "@/lib/rbac";

export const handlers: PluginApiHandlers = {
  "GET": async ({ user, request }) => {
    if (!(await hasPermission(user, "activity_log:view"))) return jsonError("Sem permissao", 403);
    const sp = new URL(request.url).searchParams;
    const from = sp.get("from");
    const to = sp.get("to");
    if (!from || !to) return jsonError("Query from e to (YYYY-MM-DD) sao obrigatorios");
    return runApiAction(() =>
      queryActivityLog({
        from,
        to,
        actorId: sp.get("actorId") ?? undefined,
        projectId: sp.get("projectId") ?? undefined,
        type: sp.get("type") ?? undefined,
        page: sp.get("page") ? Number(sp.get("page")) : undefined,
        pageSize: sp.get("pageSize") ? Number(sp.get("pageSize")) : undefined,
      }),
    );
  },

  "GET filters": async ({ user }) => {
    if (!(await hasPermission(user, "activity_log:view"))) return jsonError("Sem permissao", 403);
    return runApiAction(() => listActivityFilterOptions());
  },
};
