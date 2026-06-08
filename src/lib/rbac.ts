import "server-only";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession, type SessionUser } from "@/lib/auth";

/** Ensures there is an authenticated user; redirects to /login otherwise. */
export async function requireUser(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireAdmin(): Promise<SessionUser> {
  const session = await requireUser();
  if (session.role !== "admin") redirect("/");
  return session;
}

export type ProjectRole = "lead" | "contributor" | "viewer" | null;

/** Returns the user's role within a project (null if not a member / admin sees all). */
export async function projectRole(
  userId: string,
  projectId: string,
): Promise<ProjectRole> {
  const m = await prisma.projectMembership.findUnique({
    where: { userId_projectId: { userId, projectId } },
  });
  return (m?.role as ProjectRole) ?? null;
}

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
