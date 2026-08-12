import { jsonError, runApiAction } from "@/plugins/api-utils";
import type { PluginApiHandlers } from "@/plugins/types";
import { getUserActivitySummary, getTeamOverview } from "@/plugins/reports/actions";
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

    return runApiAction(() => getUserActivitySummary(userId, range.from, range.to));
  },

  "GET team-overview": async ({ user, request }) => {
    if (!(await hasPermission(user, "report:view_all"))) return jsonError("Sem permissao", 403);
    const range = parseRange(request);
    if ("error" in range) return jsonError(range.error);
    return runApiAction(() => getTeamOverview(range.from, range.to));
  },
};
