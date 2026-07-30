"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { parsePreferences, serializePreferences, type UserPreferences } from "@/lib/user-preferences";

export async function getUserPreferences(): Promise<UserPreferences> {
  const session = await getSession();
  if (!session) return parsePreferences(null);
  const user = await prisma.user.findUnique({ where: { id: session.id }, select: { preferences: true } });
  return parsePreferences(user?.preferences);
}

export async function saveUserPreferences(prefs: UserPreferences) {
  const session = await getSession();
  if (!session) throw new Error("Nao autenticado");
  await prisma.user.update({
    where: { id: session.id },
    data: { preferences: serializePreferences(prefs) },
  });
  revalidatePath("/", "layout");
}

export async function toggleNavItem(pluginId: string, hidden: boolean) {
  const current = await getUserPreferences();
  const set = new Set(current.navHidden ?? []);
  if (hidden) set.add(pluginId);
  else set.delete(pluginId);
  await saveUserPreferences({ ...current, navHidden: [...set] });
}

export async function setSidebarCollapsed(collapsed: boolean) {
  const current = await getUserPreferences();
  await saveUserPreferences({ ...current, sidebarCollapsed: collapsed });
}

export async function setWorkspacePrefs(workspace: UserPreferences["workspace"]) {
  const current = await getUserPreferences();
  await saveUserPreferences({
    ...current,
    workspace: workspace ?? current.workspace,
  });
}
