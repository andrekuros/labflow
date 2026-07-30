import { requireUser, hasPermission } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { bootstrapAsync } from "@/server/bootstrap";
import { getNavItems } from "@/plugins/registry";
import { unreadCount } from "@/lib/notifications";
import { Sidebar } from "@/components/sidebar";
import { AppTopbar } from "@/components/app-topbar";
import { formatProfilesLabel, resolveProfiles } from "@/lib/profile-meta";
import { parsePreferences } from "@/lib/user-preferences";
import { getLabBranding } from "@/lib/lab-branding";
import { parseProjectFeatures, isProjectKind, type ProjectFeature } from "@/lib/projects/features";

const FEATURE_TO_PLUGIN: Partial<Record<ProjectFeature, string>> = {
  board: "board",
  knowledge: "knowledge",
  forum: "forum",
  sprints: "sprints",
  roadmap: "roadmap",
  requirements: "requirements",
  deliverables: "deliverables",
  systemModel: "system-model",
  verification: "verification",
  paperPipeline: "papers",
  methodology: "thesis",
  courses: "thesis",
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireUser();
  await bootstrapAsync();

  const [user, navItems, unread, canViewActivityLog, branding] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.id } }),
    getNavItems(),
    unreadCount(session.id),
    hasPermission(session, "activity_log:view"),
    getLabBranding(),
  ]);

  const preferences = parsePreferences(user?.preferences);
  let filteredNav = canViewActivityLog
    ? navItems
    : navItems.filter((item) => item.pluginId !== "activity-log");

  // When focused on a single project, hide nav for disabled modules.
  if (preferences.workspace?.mode === "project" && preferences.workspace.projectId) {
    const p = await prisma.project.findUnique({
      where: { id: preferences.workspace.projectId },
      select: { kind: true, featuresJson: true },
    });
    if (p) {
      const kind = isProjectKind(p.kind) ? p.kind : "lab";
      const features = parseProjectFeatures(p.featuresJson, kind);
      const disabledPlugins = new Set<string>();
      for (const [feature, pluginId] of Object.entries(FEATURE_TO_PLUGIN)) {
        if (!features[feature as ProjectFeature] && pluginId) disabledPlugins.add(pluginId);
      }
      filteredNav = filteredNav.filter((item) => !disabledPlugins.has(item.pluginId));
    }
  }

  // Hide legacy / shortcut plugins that should not appear in the sidebar
  filteredNav = filteredNav.filter(
    (item) =>
      item.pluginId !== "academic" &&
      item.pluginId !== "publications" &&
      item.pluginId !== "thesis" &&
      item.pluginId !== "papers",
  );

  const userInfo = {
    name: user?.name ?? session.name,
    role: user?.role ?? session.role,
    profilesLabel: formatProfilesLabel(resolveProfiles(session)),
    avatarColor: user?.avatarColor,
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <AppTopbar
        branding={branding}
        preferences={preferences}
        unreadNotifications={unread}
        user={userInfo}
      />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <Sidebar navItems={filteredNav} preferences={preferences} />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1400px] p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
