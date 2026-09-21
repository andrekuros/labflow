import "server-only";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { getNavItems } from "@/plugins/registry";
import type { NavItem } from "@/plugins/types";
import type { UserPreferences } from "@/lib/user-preferences";
import { isProjectKind, parseProjectFeatures, type ProjectFeature } from "@/lib/projects/features";

/**
 * Which sidebar items a user actually gets.
 *
 * This lived inline in `src/app/(app)/layout.tsx`, which meant `GET /api/v1/me`
 * advertised nav the web app hides — an external UI would render items that lead
 * nowhere. Both callers now share this single definition.
 */

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

/** Reachable only from a project or a redirect — never its own sidebar entry. */
const ALWAYS_HIDDEN = new Set(["academic", "publications", "thesis", "papers"]);

/** Nav items gated behind a permission. */
const PERMISSION_GATED: Record<string, string> = {
  "activity-log": "activity_log:view",
  repository: "repository:view",
};

export async function visibleNavItems(
  user: SessionUser,
  preferences: UserPreferences,
): Promise<NavItem[]> {
  let items = await getNavItems();

  for (const [pluginId, permission] of Object.entries(PERMISSION_GATED)) {
    if (items.some((i) => i.pluginId === pluginId) && !(await hasPermission(user, permission))) {
      items = items.filter((i) => i.pluginId !== pluginId);
    }
  }

  // Single-project focus hides modules that project has turned off.
  const ws = preferences.workspace;
  if (ws?.mode === "project" && ws.projectId) {
    const project = await prisma.project.findUnique({
      where: { id: ws.projectId },
      select: { kind: true, featuresJson: true },
    });
    if (project) {
      const kind = isProjectKind(project.kind) ? project.kind : "lab";
      const features = parseProjectFeatures(project.featuresJson, kind);
      const disabled = new Set<string>();
      for (const [feature, pluginId] of Object.entries(FEATURE_TO_PLUGIN)) {
        if (pluginId && !features[feature as ProjectFeature]) disabled.add(pluginId);
      }
      items = items.filter((i) => !disabled.has(i.pluginId));
    }
  }

  return items.filter((i) => !ALWAYS_HIDDEN.has(i.pluginId));
}
