"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin, refreshSession } from "@/lib/rbac";
import { getSession } from "@/lib/auth";
import {
  formatProfilesLabel,
  setUserProfiles,
  legacyRoleToProfiles,
  normalizeProfiles,
} from "@/lib/user-profiles";
import { approveUser, rejectUser, createUser, updateUserProfile } from "@/plugins/team/actions";

export type UserRow = {
  id: string;
  name: string;
  email: string;
  accountStatus: string;
  profiles: string[];
  profilesLabel: string;
  createdAt: string;
};

export async function listUsersForSettingsAction(): Promise<UserRow[]> {
  await requireAdmin();
  const users = await prisma.user.findMany({
    orderBy: [{ accountStatus: "asc" }, { name: "asc" }],
    include: { profiles: { select: { profile: true } } },
  });

  return users.map((u) => {
    const profiles = u.profiles.length
      ? normalizeProfiles(u.profiles.map((p) => p.profile))
      : legacyRoleToProfiles(u.role);
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      accountStatus: u.accountStatus,
      profiles,
      profilesLabel: formatProfilesLabel(profiles),
      createdAt: u.createdAt.toISOString(),
    };
  });
}

export async function updateUserProfilesAction(userId: string, profiles: string[]) {
  await requireAdmin();
  const normalized = await setUserProfiles(userId, profiles);

  const session = await getSession();
  if (session?.id === userId) await refreshSession(userId);

  revalidatePath("/settings");
  revalidatePath("/team");
  revalidatePath(`/team/${userId}`);
  return { profiles: normalized };
}

export async function saveUserFromSettingsAction(
  userId: string,
  input: {
    name: string;
    email: string;
    password?: string;
    profiles: string[];
    approve?: boolean;
  },
) {
  await requireAdmin();
  const normalized = normalizeProfiles(input.profiles);
  if (normalized.length === 0) throw new Error("Selecione ao menos um perfil.");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("Usuario nao encontrado.");

  if (user.accountStatus === "pending" && input.approve) {
    await approveUser(userId, {
      name: input.name,
      email: input.email,
      password: input.password,
      profiles: normalized,
    });
  } else {
    await updateUserProfile(userId, {
      name: input.name,
      email: input.email,
      password: input.password,
      profiles: normalized,
    });
  }

  const session = await getSession();
  if (session?.id === userId) await refreshSession(userId);

  revalidatePath("/settings");
  revalidatePath("/team");
  revalidatePath(`/team/${userId}`);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function approveUserWithProfilesAction(
  userId: string,
  profiles: string[],
  input?: { name?: string; email?: string; password?: string },
) {
  await requireAdmin();
  const normalized = normalizeProfiles(profiles);
  await approveUser(userId, { profiles: normalized, ...input });
  revalidatePath("/settings");
  return { ok: true };
}

export async function rejectUserFromSettingsAction(userId: string) {
  await requireAdmin();
  await rejectUser(userId);
  revalidatePath("/settings");
  return { ok: true };
}

export async function createUserFromSettingsAction(input: {
  name: string;
  email: string;
  password: string;
  profiles: string[];
}) {
  await requireAdmin();
  const normalized = normalizeProfiles(input.profiles);
  const primary = normalized[0] ?? "contributor";
  const user = await createUser({
    name: input.name,
    email: input.email,
    password: input.password,
    role: primary,
    profiles: normalized,
  });
  revalidatePath("/settings");
  return user;
}

export async function deleteUserFromSettingsAction(userId: string) {
  await requireAdmin();
  const { deleteUser } = await import("@/plugins/team/actions");
  await deleteUser(userId);
  return { ok: true };
}

export async function importUsersFromCsvAction(csv: string) {
  await requireAdmin();
  const { importUsersFromCsv } = await import("@/plugins/team/actions");
  return importUsersFromCsv(csv);
}
