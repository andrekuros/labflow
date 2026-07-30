/** Project membership roles — shared client/server. */

export const PROJECT_MEMBER_ROLES = [
  "lead",
  "contributor",
  "viewer",
  "advisor",
  "coauthor",
] as const;

export type ProjectMemberRole = (typeof PROJECT_MEMBER_ROLES)[number];

export const PROJECT_MEMBER_ROLE_LABELS: Record<ProjectMemberRole, string> = {
  lead: "Lider",
  contributor: "Contribuidor",
  viewer: "Leitor",
  advisor: "Orientador",
  coauthor: "Coautor",
};

export const PROJECT_MEMBER_ROLE_HINTS: Record<ProjectMemberRole, string> = {
  lead: "Gerencia o projeto e a equipe",
  contributor: "Pode editar tarefas e conteudo",
  viewer: "Somente leitura",
  advisor: "Orientacao academica (tese/dissertacao/artigo)",
  coauthor: "Coautoria em artigo",
};

export function isProjectMemberRole(value: string): value is ProjectMemberRole {
  return (PROJECT_MEMBER_ROLES as readonly string[]).includes(value);
}

export function projectMemberRoleLabel(role: string): string {
  return isProjectMemberRole(role) ? PROJECT_MEMBER_ROLE_LABELS[role] : role;
}

/** Roles available when adding a member, given project kind. */
export function memberRolesForKind(kind: string, canAssignLead: boolean): ProjectMemberRole[] {
  const base: ProjectMemberRole[] = ["contributor", "viewer"];
  if (canAssignLead) base.unshift("lead");
  if (kind === "thesis" || kind === "dissertation") {
    base.push("advisor");
  }
  if (kind === "paper") {
    base.push("advisor", "coauthor");
  }
  return base;
}
