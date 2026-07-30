import { redirect } from "next/navigation";
import { requireUser, hasPermission } from "@/lib/rbac";
import { ensurePluginRegistry, getPluginSettings } from "@/plugins/registry";
import { queryActivityLog, listActivityFilterOptions } from "@/plugins/activity-log/actions";
import { ActivityLogClient } from "@/components/activity-log/activity-log-client";
import { EVENT_GROUPS } from "@/lib/activity-log/constants";

export default async function ActivityLogPage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string;
    to?: string;
    actor?: string;
    project?: string;
    type?: string;
    page?: string;
  }>;
}) {
  const session = await requireUser();
  if (!(await hasPermission(session, "activity_log:view"))) {
    redirect("/");
  }

  await ensurePluginRegistry();
  const params = await searchParams;
  const settings = getPluginSettings("activity-log");
  const periodDays = Number(settings.defaultPeriodDays ?? 7);
  const pageSize = Number(settings.pageSize ?? 50);

  const now = new Date();
  const from = params.from ?? new Date(now.getTime() - periodDays * 86400000).toISOString().slice(0, 10);
  const to = params.to ?? now.toISOString().slice(0, 10);
  const page = Math.max(1, Number(params.page ?? 1) || 1);

  const [result, filters] = await Promise.all([
    queryActivityLog({
      from,
      to,
      actorId: params.actor || undefined,
      projectId: params.project || undefined,
      type: params.type || undefined,
      page,
      pageSize,
    }),
    listActivityFilterOptions(),
  ]);

  return (
    <ActivityLogClient
      entries={result.entries}
      total={result.total}
      page={result.page}
      pageSize={result.pageSize}
      todayCount={result.todayCount}
      typeCounts={result.typeCounts}
      from={from}
      to={to}
      actorId={params.actor ?? ""}
      projectId={params.project ?? ""}
      eventType={params.type ?? ""}
      users={filters.users}
      projects={filters.projects}
      eventGroups={EVENT_GROUPS}
    />
  );
}
