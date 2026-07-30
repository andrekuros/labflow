import "server-only";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac";
import type { SessionUser } from "@/lib/auth";

/** Todos os projetos do laboratorio sao visiveis a qualquer usuario autenticado. */
export async function viewableProjectIds(_user: SessionUser): Promise<string[]> {
  const all = await prisma.project.findMany({ select: { id: true } });
  return all.map((p) => p.id);
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
  for (const m of memberships) {
    map[m.projectId] = m.role === "lead" || m.role === "contributor" || m.role === "coauthor";
  }
  return map;
}
