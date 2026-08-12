import "server-only";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession, buildSessionUser, createSession, type SessionUser } from "@/lib/auth";
import { canLogin, isAdminUser } from "@/lib/user-access";
import { resolveProfiles } from "@/lib/user-profiles";
import { isApiRequestContext } from "@/lib/request-user";

export { isAdminUser };

function denyAuth(path: string): never {
  if (isApiRequestContext()) throw new Error("Nao autenticado");
  redirect(path);
}

function denyPermission(): never {
  if (isApiRequestContext()) throw new Error("Sem permissao");
  redirect("/");
}

/** Ensures there is an authenticated active user; redirects to /login otherwise. */
export async function requireUser(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) denyAuth("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { accountStatus: true },
  });
  if (!user || !canLogin(user.accountStatus)) denyAuth("/login?status=inactive");

  return session;
}

export async function requireAdmin(): Promise<SessionUser> {
  const session = await requireUser();
  if (!isAdminUser(session)) denyPermission();
  return session;
}

export type ProjectRole = "lead" | "contributor" | "viewer" | "advisor" | "coauthor" | null;

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
 * - Uniao das permissoes de todos os perfis do usuario.
 * - If projectId is provided, the user's project membership role is also
 *   checked (lead gets project_manager-level permissions within the project).
 */
export async function hasPermission(
  user: SessionUser,
  permissionKey: string,
  projectId?: string,
): Promise<boolean> {
  if (isAdminUser(user)) return true;

  const perms = await loadPermissions();
  const profiles = resolveProfiles(user);

  for (const profile of profiles) {
    const profilePerms = perms.get(profile);
    if (profilePerms?.has(permissionKey)) return true;
  }

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

/** Redirects to / if the user lacks the given permission (throws in API context). */
export async function requirePermission(
  permissionKey: string,
  projectId?: string,
): Promise<SessionUser> {
  const session = await requireUser();
  const ok = await hasPermission(session, permissionKey, projectId);
  if (!ok) denyPermission();
  return session;
}

/** Atualiza o cookie de sessao apos mudanca de perfis. */
export async function refreshSession(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true },
  });
  if (!user) return;
  const session = await buildSessionUser(user);
  await createSession(session);
}

// ---------------------------------------------------------------------------
// Legacy wrappers (backward compatible)
// ---------------------------------------------------------------------------

/** Admins and project leads/contributors/coauthors can write. Viewers and advisors (read-ish) cannot. */
export async function canWriteProject(
  user: SessionUser,
  projectId: string,
): Promise<boolean> {
  if (isAdminUser(user)) return true;
  const role = await projectRole(user.id, projectId);
  return role === "lead" || role === "contributor" || role === "coauthor";
}

/** Projetos do laboratorio sao visiveis a qualquer usuario autenticado (membro ou nao). */
export async function canViewProject(
  _user: SessionUser,
  _projectId: string,
): Promise<boolean> {
  return true;
}

/** Lider do projeto ou administrador global. */
export async function isProjectLead(user: SessionUser, projectId: string): Promise<boolean> {
  if (isAdminUser(user)) return true;
  const role = await projectRole(user.id, projectId);
  return role === "lead";
}

export async function canManageProject(user: SessionUser, projectId: string): Promise<boolean> {
  return isProjectLead(user, projectId);
}

/** Somente administradores podem designar lider de projeto. */
export function canAssignProjectLead(user: SessionUser): boolean {
  return isAdminUser(user);
}
