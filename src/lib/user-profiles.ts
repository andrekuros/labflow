import "server-only";
import { prisma } from "@/lib/db";
import { syncAcademicProfileProgram } from "@/lib/academic-program";
import {
  SYSTEM_PROFILES,
  PROFILE_LABELS,
  type SystemProfile,
  normalizeProfiles,
  primaryProfile,
  legacyRoleToProfiles,
  formatProfilesLabel,
  resolveProfiles,
  userHasProfile,
  userHasAnyProfile,
  type SessionLike,
} from "@/lib/profile-meta";

export {
  SYSTEM_PROFILES,
  PROFILE_LABELS,
  type SystemProfile,
  normalizeProfiles,
  primaryProfile,
  legacyRoleToProfiles,
  formatProfilesLabel,
  resolveProfiles,
  userHasProfile,
  userHasAnyProfile,
  type SessionLike,
};

export async function getUserProfileKeys(userId: string): Promise<SystemProfile[]> {
  const rows = await prisma.userProfile.findMany({
    where: { userId },
    select: { profile: true },
    orderBy: { profile: "asc" },
  });
  if (rows.length > 0) return normalizeProfiles(rows.map((r) => r.profile));
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  return user ? normalizeProfiles(legacyRoleToProfiles(user.role)) : [];
}

export async function setUserProfiles(userId: string, profiles: string[]): Promise<SystemProfile[]> {
  const normalized = normalizeProfiles(profiles);
  if (normalized.length === 0) throw new Error("Selecione ao menos um perfil.");

  await prisma.userProfile.deleteMany({ where: { userId } });
  await prisma.userProfile.createMany({
    data: normalized.map((profile) => ({ userId, profile })),
  });

  const primary = primaryProfile(normalized);
  await prisma.user.update({ where: { id: userId }, data: { role: primary } });
  await syncAcademicProfileProgram(userId, normalized);

  return normalized;
}

export async function ensureUserProfilesFromRole(userId: string, role: string) {
  const existing = await prisma.userProfile.count({ where: { userId } });
  if (existing > 0) return;
  await setUserProfiles(userId, legacyRoleToProfiles(role));
}
