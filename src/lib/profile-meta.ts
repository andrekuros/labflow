/** Metadados de perfis — compartilhado entre client e server. */

export const SYSTEM_PROFILES = [
  "admin",
  "project_manager",
  "researcher",
  "professor",
  "phd",
  "msc",
  "postdoc",
  "contributor",
  "student",
  "viewer",
] as const;

export type SystemProfile = (typeof SYSTEM_PROFILES)[number];

export const PROFILE_LABELS: Record<SystemProfile, string> = {
  admin: "Administrador",
  project_manager: "Gerente de Projetos",
  researcher: "Pesquisador",
  professor: "Professor",
  phd: "Doutorando",
  msc: "Mestrando",
  postdoc: "Pos-doutorando",
  contributor: "Colaborador",
  student: "Aluno / IC",
  viewer: "Visualizador",
};

export const PROFILE_PRIORITY: SystemProfile[] = [
  "admin",
  "project_manager",
  "researcher",
  "professor",
  "phd",
  "postdoc",
  "msc",
  "contributor",
  "student",
  "viewer",
];

const VALID_PROFILES = new Set<string>(SYSTEM_PROFILES);

export function isValidProfile(profile: string): profile is SystemProfile {
  return VALID_PROFILES.has(profile);
}

export function normalizeProfiles(profiles: string[]): SystemProfile[] {
  const out: SystemProfile[] = [];
  const seen = new Set<string>();
  for (const p of profiles) {
    const key = p.trim();
    if (!isValidProfile(key) || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

export function primaryProfile(profiles: string[]): string {
  const normalized = normalizeProfiles(profiles);
  for (const p of PROFILE_PRIORITY) {
    if (normalized.includes(p)) return p;
  }
  return normalized[0] ?? "contributor";
}

export function formatProfilesLabel(profiles: string[]): string {
  const normalized = normalizeProfiles(profiles);
  if (normalized.length === 0) return "—";
  return normalized.map((p) => PROFILE_LABELS[p]).join(", ");
}

/** Converte papel legado (unico) para conjunto de perfis. */
export function legacyRoleToProfiles(role: string): SystemProfile[] {
  const map: Record<string, SystemProfile[]> = {
    admin: ["admin"],
    project_manager: ["project_manager"],
    researcher: ["researcher"],
    contributor: ["contributor"],
    viewer: ["viewer"],
    phd: ["researcher", "phd"],
    msc: ["researcher", "msc"],
    postdoc: ["researcher", "postdoc"],
    student: ["contributor", "student"],
    professor: ["researcher", "professor"],
  };
  return map[role] ?? normalizeProfiles([role]);
}

export type SessionLike = { profiles?: string[]; role?: string };

export function resolveProfiles(user: SessionLike): string[] {
  if (user.profiles?.length) return normalizeProfiles(user.profiles);
  if (user.role) return legacyRoleToProfiles(user.role);
  return [];
}

export function userHasProfile(user: SessionLike, profile: string): boolean {
  return resolveProfiles(user).includes(profile);
}

export function userHasAnyProfile(user: SessionLike, profiles: string[]): boolean {
  const set = new Set(resolveProfiles(user));
  return profiles.some((p) => set.has(p));
}
