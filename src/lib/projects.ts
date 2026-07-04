import "server-only";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac";
import type { SessionUser } from "@/lib/auth";

/** Project ids the user can view (admins see all). */
export async function viewableProjectIds(user: SessionUser): Promise<string[]> {
  if (await hasPermission(user, "project:view")) {
    const all = await prisma.project.findMany({ select: { id: true } });
    return all.map((p) => p.id);
  }
  const memberships = await prisma.projectMembership.findMany({
    where: { userId: user.id },
    select: { projectId: true },
  });
  return memberships.map((m) => m.projectId);
}

/** Map of projectId -> can the user write. */
export async function writableMap(user: SessionUser, projectIds: string[]) {
  const map: Record<string, boolean> = {};
  if (await hasPermission(user, "project:edit")) {
    for (const id of projectIds) map[id] = true;
    return map;
  }
  const memberships = await prisma.projectMembership.findMany({
    where: { userId: user.id, projectId: { in: projectIds } },
  });
  for (const id of projectIds) map[id] = false;
  for (const m of memberships) map[m.projectId] = m.role === "lead" || m.role === "contributor";
  return map;
}
