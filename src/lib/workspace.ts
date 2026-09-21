import "server-only";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";
import { viewableProjectIds } from "@/lib/projects";
import { parsePreferences } from "@/lib/user-preferences";
import { isProjectKind, type ProjectKind } from "@/lib/projects/features";
import type { WorkspaceMode, WorkspacePrefs } from "@/lib/workspace-prefs";
import { DEFAULT_WORKSPACE, kindsFromToggles, workspaceLabel } from "@/lib/workspace-prefs";

export async function getUserWorkspace(userId: string): Promise<WorkspacePrefs> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferences: true },
  });
  return parsePreferences(user?.preferences).workspace ?? { ...DEFAULT_WORKSPACE };
}

/**
 * The resolved project scope of the current workspace context.
 *
 * Every surface that aggregates numbers (dashboard KPIs, reports, BI, activity
 * log, weekly email) must scope through this, otherwise the topbar filters lie:
 * turning off "academic" would change /projects but leave the dashboard counting
 * theses anyway.
 */
export type WorkspaceScope = {
  /** Projects the user may see AND that pass the workspace filter. */
  projectIds: string[];
  /** Everything visible ignoring the filter — for "8 de 21 projetos" and `scope=all`. */
  visibleProjectIds: string[];
  visibleCount: number;
  /** True when the filter actually narrows the lab (kind toggles or single project). */
  focused: boolean;
  /** Human label of the active context, e.g. "Teses e dissertacoes · Admin". */
  label: string;
  mode: WorkspaceMode;
  kinds: ProjectKind[] | undefined;
  onlyMine: boolean;
  projectId: string | null;
};

/**
 * Resolve the workspace context once, with both the filtered and the unfiltered
 * counts, so callers never need a second round trip to explain the filter.
 */
export async function resolveWorkspaceScope(user: SessionUser): Promise<WorkspaceScope> {
  const visible = await viewableProjectIds(user);
  const ws = await getUserWorkspace(user.id);
  const kinds = (ws.kindToggles ? kindsFromToggles(ws.kindToggles) : ws.includeKinds)?.filter(
    isProjectKind,
  );

  const base: WorkspaceScope = {
    projectIds: visible,
    visibleProjectIds: visible,
    visibleCount: visible.length,
    focused: false,
    label: workspaceLabel(ws),
    mode: ws.mode,
    kinds: kinds?.length ? kinds : undefined,
    onlyMine: Boolean(ws.onlyMine),
    projectId: ws.projectId ?? null,
  };

  if (visible.length === 0) return base;

  let scoped = visible;

  if (ws.onlyMine) {
    const mine = await prisma.projectMembership.findMany({
      where: { userId: user.id, projectId: { in: scoped } },
      select: { projectId: true },
    });
    const mineSet = new Set(mine.map((m) => m.projectId));
    scoped = scoped.filter((id) => mineSet.has(id));
  }

  if (ws.mode === "project" && ws.projectId) {
    const single = scoped.includes(ws.projectId) ? [ws.projectId] : [];
    return { ...base, projectIds: single, focused: true };
  }

  if (base.kinds?.length) {
    const rows = await prisma.project.findMany({
      where: { id: { in: scoped }, kind: { in: base.kinds } },
      select: { id: true },
    });
    scoped = rows.map((r) => r.id);
  }

  return {
    ...base,
    projectIds: scoped,
    focused: Boolean(base.kinds?.length) || scoped.length !== visible.length,
  };
}

/**
 * Project ids in the current workspace context.
 * Intersects visibility with workspace mode/filters.
 */
export async function workspaceProjectIds(user: SessionUser): Promise<string[]> {
  const scope = await resolveWorkspaceScope(user);
  return scope.projectIds;
}

/**
 * Prisma filter for a `projectId` column under the current scope.
 * Unfocused contexts return `undefined` so queries stay index-friendly.
 */
export function scopeProjectFilter(scope: WorkspaceScope): { in: string[] } | undefined {
  return scope.focused ? { in: scope.projectIds } : undefined;
}

export async function findMyThesisProject(userId: string): Promise<{
  id: string;
  key: string;
  name: string;
  kind: "thesis" | "dissertation";
} | null> {
  const row = await prisma.project.findFirst({
    where: {
      kind: { in: ["thesis", "dissertation"] },
      memberships: { some: { userId, role: "lead" } },
    },
    select: { id: true, key: true, name: true, kind: true },
    orderBy: { updatedAt: "desc" },
  });
  if (!row) return null;
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    kind: row.kind as "thesis" | "dissertation",
  };
}
