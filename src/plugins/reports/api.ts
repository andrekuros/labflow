import { jsonError, runApiAction } from "@/plugins/api-utils";
import type { PluginApiHandlers } from "@/plugins/types";
import { getUserActivitySummary, getTeamOverview } from "@/plugins/reports/actions";
import { getPortfolioOverview } from "@/lib/portfolio";
import { resolveWorkspaceScope } from "@/lib/workspace";
import { hasPermission } from "@/lib/rbac";

function parseRange(request: Request): { from: Date; to: Date } | { error: string } {
  const sp = new URL(request.url).searchParams;
  const fromStr = sp.get("from");
  const toStr = sp.get("to");
  if (!fromStr || !toStr) return { error: "Query from e to (ISO date) sao obrigatorios" };
  const from = new Date(fromStr);
  const to = new Date(toStr.includes("T") ? toStr : `${toStr}T23:59:59.999`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return { error: "Datas from/to invalidas" };
  }
  return { from, to };
}

export const handlers: PluginApiHandlers = {
  "GET activity": async ({ user, request }) => {
    const canViewAll = await hasPermission(user, "report:view_all");
    const canView = await hasPermission(user, "report:view");
    if (!canView && !canViewAll) return jsonError("Sem permissao", 403);

    const range = parseRange(request);
    if ("error" in range) return jsonError(range.error);

    const userId = new URL(request.url).searchParams.get("userId") ?? user.id;
    if (userId !== user.id && !canViewAll) return jsonError("Sem permissao", 403);

    const scope = await resolveWorkspaceScope(user);
    return runApiAction(() =>
      getUserActivitySummary(userId, range.from, range.to, {
        projectIds: scope.focused ? scope.projectIds : undefined,
      }),
    );
  },

  "GET team-overview": async ({ user, request }) => {
    if (!(await hasPermission(user, "report:view_all"))) return jsonError("Sem permissao", 403);
    const range = parseRange(request);
    if ("error" in range) return jsonError(range.error);
    const scope = await resolveWorkspaceScope(user);
    return runApiAction(() =>
      getTeamOverview(range.from, range.to, {
        projectIds: scope.focused ? scope.projectIds : undefined,
      }),
    );
  },

  /**
   * Portfolio BI: one row per project with health, schedule and throughput.
   * Scoped by the caller's workspace context unless `scope=all` is passed.
   */
  "GET portfolio": async ({ user, request }) => {
    const canViewAll = await hasPermission(user, "report:view_all");
    if (!canViewAll && !(await hasPermission(user, "report:view"))) {
      return jsonError("Sem permissao", 403);
    }
    const range = parseRange(request);
    if ("error" in range) return jsonError(range.error);

    const sp = new URL(request.url).searchParams;
    const scope = await resolveWorkspaceScope(user);
    const ignoreScope = sp.get("scope") === "all" && canViewAll;

    return runApiAction(() =>
      getPortfolioOverview(range.from, range.to, {
        projectIds: ignoreScope ? scope.visibleProjectIds : scope.projectIds,
      }),
    );
  },
};
