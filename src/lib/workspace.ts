import "server-only";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";
import { viewableProjectIds } from "@/lib/projects";
import { parsePreferences } from "@/lib/user-preferences";
import { isProjectKind } from "@/lib/projects/features";
import type { WorkspacePrefs } from "@/lib/workspace-prefs";
import { DEFAULT_WORKSPACE, kindsFromToggles } from "@/lib/workspace-prefs";

export async function getUserWorkspace(userId: string): Promise<WorkspacePrefs> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferences: true },
  });
  return parsePreferences(user?.preferences).workspace ?? { ...DEFAULT_WORKSPACE };
}

/**
 * Project ids in the current workspace context.
 * Intersects visibility with workspace mode/filters.
 */
export async function workspaceProjectIds(user: SessionUser): Promise<string[]> {
  let viewable = await viewableProjectIds(user);
  if (viewable.length === 0) return [];

  const ws = await getUserWorkspace(user.id);

  const filterKinds = ws.kindToggles
    ? kindsFromToggles(ws.kindToggles)
    : ws.includeKinds;

  if (ws.onlyMine) {
    const mine = await prisma.projectMembership.findMany({
      where: { userId: user.id, projectId: { in: viewable } },
      select: { projectId: true },
    });
    const mineSet = new Set(mine.map((m) => m.projectId));
    viewable = viewable.filter((id) => mineSet.has(id));
  }

  if (ws.mode === "project" && ws.projectId) {
    return viewable.includes(ws.projectId) ? [ws.projectId] : [];
  }

  if (filterKinds?.length) {
    const kinds = filterKinds.filter(isProjectKind);
    const rows = await prisma.project.findMany({
      where: { id: { in: viewable }, kind: { in: kinds } },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  return viewable;
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
