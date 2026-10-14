import "server-only";
import type { Prisma } from "@prisma/client";
import type { SessionUser } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { isAdminUser } from "@/lib/user-access";

/**
 * Repository access rules.
 *
 * Two independent axes, both enforced in the database `where` clause so a record
 * never leaks through a list endpoint that forgot to filter:
 *  - `visibility`: public (any signed-in user) | members | admin
 *  - `status`: an unpublished record is visible only to its submitter and to
 *    whoever can manage the repository
 */

export type RecordAccess = {
  id: string;
  status: string;
  visibility: string;
  submitterId: string | null;
};

export async function canManageRepository(user: SessionUser): Promise<boolean> {
  return isAdminUser(user) || (await hasPermission(user, "repository:manage"));
}

export async function canViewRepository(user: SessionUser): Promise<boolean> {
  return hasPermission(user, "repository:view");
}

export async function canCreateRecord(user: SessionUser): Promise<boolean> {
  return hasPermission(user, "repository:create");
}

export async function canEditRecord(user: SessionUser, record: RecordAccess): Promise<boolean> {
  if (await canManageRepository(user)) return true;
  if (!(await hasPermission(user, "repository:edit"))) return false;
  // A contributor may keep editing their own deposit until it is published.
  return record.submitterId === user.id && record.status !== "published";
}

export async function assertCanEditRecord(user: SessionUser, record: RecordAccess): Promise<void> {
  if (!(await canEditRecord(user, record))) throw new Error("Sem permissao para editar este registro");
}

export async function canDeleteRecord(user: SessionUser, record: RecordAccess): Promise<boolean> {
  if (await canManageRepository(user)) return true;
  if (!(await hasPermission(user, "repository:delete"))) return false;
  return record.submitterId === user.id && record.status === "draft";
}

export async function canViewRecord(user: SessionUser, record: RecordAccess): Promise<boolean> {
  if (!(await canViewRepository(user))) return false;
  const manage = await canManageRepository(user);
  if (manage) return true;
  if (record.visibility === "admin") return false;
  if (record.status === "published") return true;
  return record.submitterId === user.id;
}

/**
 * The `where` fragment that expresses the rules above. Compose it with AND into
 * any list/search query.
 */
export async function recordVisibilityWhere(
  user: SessionUser,
): Promise<Prisma.RepositoryRecordWhereInput> {
  if (await canManageRepository(user)) return {};
  return {
    visibility: { not: "admin" },
    OR: [{ status: "published" }, { submitterId: user.id }],
  };
}

/** Collections whose own visibility hides them from this user. */
export async function collectionVisibilityWhere(
  user: SessionUser,
): Promise<Prisma.RepositoryCollectionWhereInput> {
  if (await canManageRepository(user)) return {};
  return { visibility: { not: "admin" } };
}
