import "server-only";

export const ACCOUNT_STATUSES = ["active", "pending", "rejected"] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const ACCOUNT_STATUS_LABELS: Record<AccountStatus, string> = {
  active: "Ativo",
  pending: "Aguardando aprovacao",
  rejected: "Rejeitado",
};

export const SYSTEM_ROLES = ["admin", "researcher", "project_manager", "contributor", "viewer"] as const;
export type SystemRole = (typeof SYSTEM_ROLES)[number];

export const SYSTEM_ROLE_LABELS: Record<SystemRole, string> = {
  admin: "Administrador",
  researcher: "Pesquisador",
  project_manager: "Gerente de Projetos",
  contributor: "Colaborador",
  viewer: "Visualizador",
};

export const ACADEMIC_PROGRAMS = ["msc", "phd", "postdoc", "professor", "student"] as const;
export type AcademicProgram = (typeof ACADEMIC_PROGRAMS)[number];

export const ACADEMIC_PROGRAM_LABELS: Record<AcademicProgram, string> = {
  msc: "Mestrando",
  phd: "Doutorando",
  postdoc: "Pos-doutorando",
  professor: "Professor",
  student: "Aluno",
};

export function canLogin(status: string): boolean {
  return status === "active";
}

export function isAdminRole(role: string): boolean {
  return role === "admin";
}

export function canManageUserProfiles(role: string): boolean {
  return role === "admin";
}
