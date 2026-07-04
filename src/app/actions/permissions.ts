"use server";

import { prisma } from "@/lib/db";
import { requireAdmin, invalidatePermissionCache } from "@/lib/rbac";

export async function listPermissionsAction() {
  await requireAdmin();
  return prisma.permission.findMany({ orderBy: [{ module: "asc" }, { action: "asc" }] });
}

export async function getRolePermissionsAction() {
  await requireAdmin();
  const rows = await prisma.rolePermission.findMany({
    include: { permission: { select: { key: true } } },
  });
  const map: Record<string, string[]> = {};
  for (const r of rows) {
    if (!map[r.role]) map[r.role] = [];
    map[r.role].push(r.permission.key);
  }
  return map;
}

export async function updateRolePermissionsAction(role: string, permissionKeys: string[]) {
  await requireAdmin();
  if (role === "admin") return;

  const allPerms = await prisma.permission.findMany();
  const keyToId = Object.fromEntries(allPerms.map((p) => [p.key, p.id]));
  const wantedIds = new Set(permissionKeys.map((k) => keyToId[k]).filter(Boolean));

  const existing = await prisma.rolePermission.findMany({ where: { role } });
  const existingIds = new Set(existing.map((e) => e.permissionId));

  const toAdd = [...wantedIds].filter((id) => !existingIds.has(id));
  const toRemove = [...existingIds].filter((id) => !wantedIds.has(id));

  for (const permId of toRemove) {
    await prisma.rolePermission.delete({
      where: { role_permissionId: { role, permissionId: permId } },
    });
  }
  for (const permId of toAdd) {
    await prisma.rolePermission.create({ data: { role, permissionId: permId } });
  }

  invalidatePermissionCache();
}
