import "server-only";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession, type SessionUser } from "@/lib/auth";
import { canLogin } from "@/lib/user-access";

/** Ensures there is an authenticated active user; redirects to /login otherwise. */
export async function requireUser(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { accountStatus: true },
  });
  if (!user || !canLogin(user.accountStatus)) redirect("/login?status=inactive");

  return session;
}

export async function requireAdmin(): Promise<SessionUser> {
  const session = await requireUser();
  if (session.role !== "admin") redirect("/");
  return session;
}

export type ProjectRole = "lead" | "contributor" | "viewer" | null;

/** Returns the user's role within a project (null if not a member). */
export async function projectRole(
  userId: string,
  projectId: string,
): Promise<ProjectRole> {
  const m = await prisma.projectMembership.findUnique({
    where: { userId_projectId: { userId, projectId } },
  });
  return (m?.role as ProjectRole) ?? null;
}

// ---------------------------------------------------------------------------
// Permission cache (in-memory, TTL-based)
// ---------------------------------------------------------------------------

type PermCache = { data: Map<string, Set<string>>; ts: number };
const CACHE_TTL_MS = 60_000;
const globalForCache = globalThis as unknown as { __permCache?: PermCache };

async function loadPermissions(): Promise<Map<string, Set<string>>> {
  const cached = globalForCache.__permCache;
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.data;

  const rows = await prisma.rolePermission.findMany({
    include: { permission: { select: { key: true } } },
  });

  const map = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!map.has(r.role)) map.set(r.role, new Set());
    map.get(r.role)!.add(r.permission.key);
  }

  globalForCache.__permCache = { data: map, ts: Date.now() };
  return map;
}

/** Invalidate the in-memory permission cache (call after admin edits permissions). */
export function invalidatePermissionCache() {
  globalForCache.__permCache = undefined;
}

// ---------------------------------------------------------------------------
// Core permission check
// ---------------------------------------------------------------------------

/**
 * Checks whether a user has a given permission.
 * - admin always passes.
 * - Global role permissions are checked first.
 * - If projectId is provided, the user's project membership role is also
 *   checked (lead gets project_manager-level permissions within the project).
 */
export async function hasPermission(
  user: SessionUser,
  permissionKey: string,
  projectId?: string,
): Promise<boolean> {
  if (user.role === "admin") return true;

  const perms = await loadPermissions();

  const rolePerms = perms.get(user.role);
  if (rolePerms?.has(permissionKey)) return true;

  if (projectId) {
    const role = await projectRole(user.id, projectId);
    if (role === "lead") {
      const pmPerms = perms.get("project_manager");
      if (pmPerms?.has(permissionKey)) return true;
    }
    if (role === "contributor") {
      const contribPerms = perms.get("contributor");
      if (contribPerms?.has(permissionKey)) return true;
    }
  }

  return false;
}

/** Redirects to / if the user lacks the given permission. */
export async function requirePermission(
  permissionKey: string,
  projectId?: string,
): Promise<SessionUser> {
  const session = await requireUser();
  const ok = await hasPermission(session, permissionKey, projectId);
  if (!ok) redirect("/");
  return session;
}

// ---------------------------------------------------------------------------
// Legacy wrappers (backward compatible)
// ---------------------------------------------------------------------------

/** Admins and project leads/contributors can write. Viewers and non-members cannot. */
export async function canWriteProject(
  user: SessionUser,
  projectId: string,
): Promise<boolean> {
  if (user.role === "admin") return true;
  const role = await projectRole(user.id, projectId);
  return role === "lead" || role === "contributor";
}

export async function canViewProject(
  user: SessionUser,
  projectId: string,
): Promise<boolean> {
  if (user.role === "admin") return true;
  const role = await projectRole(user.id, projectId);
  return role !== null;
}
