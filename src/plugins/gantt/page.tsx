import { requireUser, hasPermission } from "@/lib/rbac";
import { resolveWorkspaceScope } from "@/lib/workspace";
import { ensurePluginRegistry, getPluginSettings } from "@/plugins/registry";
import { getGanttData } from "@/lib/gantt";
import { GanttClient } from "@/components/gantt/gantt-client";
import { EmptyState } from "@/components/ui";

export default async function GanttPluginPage() {
  const session = await requireUser();
  await ensurePluginRegistry();

  if (!(await hasPermission(session, "project:view"))) {
    return <EmptyState title="Sem permissao" description="Voce nao tem permissao para ver o cronograma." />;
  }

  const scope = await resolveWorkspaceScope(session);
  const settings = getPluginSettings("gantt");

  const data = await getGanttData({
    projectIds: scope.projectIds,
    includeDone: settings.includeDone !== false,
    inferredDurationDays: Number(settings.inferredDurationDays ?? 5),
  });

  return (
    <GanttClient
      data={data}
      scope={{
        label: scope.label,
        focused: scope.focused,
        scopedCount: scope.projectIds.length,
        visibleCount: scope.visibleCount,
      }}
    />
  );
}
