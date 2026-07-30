import "server-only";

export { ACCOUNT_STATUSES, ACCOUNT_STATUS_LABELS, type AccountStatus } from "@/lib/user-meta";

export {
  SYSTEM_PROFILES,
  PROFILE_LABELS,
  type SystemProfile,
  userHasProfile,
  userHasAnyProfile,
  resolveProfiles,
  type SessionLike,
} from "@/lib/profile-meta";

import { userHasProfile, userHasAnyProfile, type SessionLike } from "@/lib/profile-meta";

export {
  ACADEMIC_PROGRAMS,
  ACADEMIC_PROGRAM_LABELS,
  ACADEMIC_PROGRAM_TYPE_LABELS,
  type AcademicProgram,
} from "@/lib/academic-program-meta";

export function canLogin(status: string): boolean {
  return status === "active";
}

export function isAdminRole(role: string): boolean {
  return role === "admin";
}

export function isAdminUser(user: SessionLike): boolean {
  return userHasProfile(user, "admin");
}

export function canManageUserProfiles(user: SessionLike): boolean {
  return isAdminUser(user);
}

export function canViewAllReports(user: SessionLike): boolean {
  return userHasProfile(user, "admin") || userHasProfile(user, "project_manager");
}

export function canViewAcademicProfiles(user: SessionLike): boolean {
  return userHasAnyProfile(user, ["admin", "researcher", "project_manager", "professor"]);
}
