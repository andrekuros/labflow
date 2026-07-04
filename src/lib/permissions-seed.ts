import "server-only";
import { prisma } from "@/lib/db";

export type PermissionDef = {
  key: string;
  description: string;
  module: string;
  action: string;
};

const PERMISSIONS: PermissionDef[] = [
  // project
  { key: "project:view", description: "Visualizar projetos", module: "project", action: "view" },
  { key: "project:create", description: "Criar projetos", module: "project", action: "create" },
  { key: "project:edit", description: "Editar projetos", module: "project", action: "edit" },
  { key: "project:delete", description: "Excluir projetos", module: "project", action: "delete" },
  // task
  { key: "task:view", description: "Visualizar tarefas", module: "task", action: "view" },
  { key: "task:create", description: "Criar tarefas", module: "task", action: "create" },
  { key: "task:edit", description: "Editar tarefas", module: "task", action: "edit" },
  { key: "task:delete", description: "Excluir tarefas", module: "task", action: "delete" },
  // requirement
  { key: "requirement:view", description: "Visualizar requisitos", module: "requirement", action: "view" },
  { key: "requirement:create", description: "Criar requisitos", module: "requirement", action: "create" },
  { key: "requirement:edit", description: "Editar requisitos", module: "requirement", action: "edit" },
  { key: "requirement:delete", description: "Excluir requisitos", module: "requirement", action: "delete" },
  // deliverable
  { key: "deliverable:view", description: "Visualizar entregaveis", module: "deliverable", action: "view" },
  { key: "deliverable:create", description: "Criar entregaveis", module: "deliverable", action: "create" },
  { key: "deliverable:edit", description: "Editar entregaveis", module: "deliverable", action: "edit" },
  { key: "deliverable:delete", description: "Excluir entregaveis", module: "deliverable", action: "delete" },
  // knowledge
  { key: "knowledge:view", description: "Visualizar conhecimento", module: "knowledge", action: "view" },
  { key: "knowledge:create", description: "Criar artigos", module: "knowledge", action: "create" },
  { key: "knowledge:edit", description: "Editar artigos", module: "knowledge", action: "edit" },
  { key: "knowledge:delete", description: "Excluir artigos", module: "knowledge", action: "delete" },
  // forum
  { key: "forum:view", description: "Visualizar forum", module: "forum", action: "view" },
  { key: "forum:create", description: "Criar topicos/posts", module: "forum", action: "create" },
  { key: "forum:edit", description: "Editar topicos/posts", module: "forum", action: "edit" },
  { key: "forum:delete", description: "Excluir topicos/posts", module: "forum", action: "delete" },
  // sprint
  { key: "sprint:view", description: "Visualizar sprints", module: "sprint", action: "view" },
  { key: "sprint:create", description: "Criar sprints", module: "sprint", action: "create" },
  { key: "sprint:edit", description: "Editar sprints", module: "sprint", action: "edit" },
  { key: "sprint:delete", description: "Excluir sprints", module: "sprint", action: "delete" },
  // academic
  { key: "academic:view", description: "Visualizar proprio perfil academico", module: "academic", action: "view" },
  { key: "academic:edit", description: "Editar proprio perfil academico", module: "academic", action: "edit" },
  { key: "academic:view_all", description: "Visualizar todos os perfis academicos", module: "academic", action: "view_all" },
  // team
  { key: "team:view", description: "Visualizar equipe", module: "team", action: "view" },
  { key: "team:manage", description: "Gerenciar usuarios", module: "team", action: "manage" },
  // settings
  { key: "settings:view", description: "Visualizar configuracoes pessoais", module: "settings", action: "view" },
  { key: "settings:manage", description: "Gerenciar configuracoes do sistema", module: "settings", action: "manage" },
  // feedback
  { key: "feedback:view", description: "Visualizar feedback proprio", module: "feedback", action: "view" },
  { key: "feedback:create", description: "Enviar feedback", module: "feedback", action: "create" },
  { key: "feedback:manage", description: "Gerenciar todos os feedbacks", module: "feedback", action: "manage" },
  // assistant
  { key: "assistant:use", description: "Usar assistente de IA", module: "assistant", action: "use" },
  // roadmap
  { key: "roadmap:view", description: "Visualizar roadmap", module: "roadmap", action: "view" },
  { key: "roadmap:edit", description: "Editar roadmap", module: "roadmap", action: "edit" },
  // system-model
  { key: "system_model:view", description: "Visualizar modelo do sistema", module: "system_model", action: "view" },
  { key: "system_model:edit", description: "Editar modelo do sistema", module: "system_model", action: "edit" },
  // verification
  { key: "verification:view", description: "Visualizar verificacao", module: "verification", action: "view" },
  { key: "verification:edit", description: "Editar verificacao", module: "verification", action: "edit" },
  // report
  { key: "report:view", description: "Visualizar proprio relatorio", module: "report", action: "view" },
  { key: "report:view_all", description: "Visualizar relatorios de todos", module: "report", action: "view_all" },
  { key: "report:export", description: "Exportar relatorios", module: "report", action: "export" },
];

const ALL_KEYS = PERMISSIONS.map((p) => p.key);

const VIEW_KEYS = PERMISSIONS.filter((p) => p.action === "view").map((p) => p.key);

const ROLE_DEFAULTS: Record<string, string[]> = {
  admin: ALL_KEYS,
  researcher: [
    ...VIEW_KEYS,
    "project:create", "project:edit",
    "task:create", "task:edit",
    "requirement:create", "requirement:edit",
    "deliverable:create", "deliverable:edit",
    "knowledge:create", "knowledge:edit",
    "forum:create", "forum:edit",
    "sprint:create", "sprint:edit",
    "academic:edit",
    "feedback:create",
    "assistant:use",
    "roadmap:edit",
    "system_model:edit",
    "verification:edit",
    "report:export",
  ],
  project_manager: [
    ...VIEW_KEYS,
    "project:create", "project:edit", "project:delete",
    "task:create", "task:edit", "task:delete",
    "requirement:create", "requirement:edit", "requirement:delete",
    "deliverable:create", "deliverable:edit", "deliverable:delete",
    "knowledge:create", "knowledge:edit",
    "forum:create", "forum:edit",
    "sprint:create", "sprint:edit", "sprint:delete",
    "academic:edit", "academic:view_all",
    "feedback:create", "feedback:manage",
    "assistant:use",
    "roadmap:edit",
    "system_model:edit",
    "verification:edit",
    "report:view_all", "report:export",
  ],
  contributor: [
    ...VIEW_KEYS,
    "task:create", "task:edit",
    "knowledge:create",
    "forum:create",
    "academic:edit",
    "feedback:create",
    "assistant:use",
  ],
  viewer: [
    ...VIEW_KEYS,
    "feedback:create",
  ],
};

export { PERMISSIONS, ROLE_DEFAULTS };

/** Ensures all Permission rows and default RolePermission mappings exist. Idempotent. */
export async function seedPermissions() {
  for (const def of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: def.key },
      update: { description: def.description, module: def.module, action: def.action },
      create: { key: def.key, description: def.description, module: def.module, action: def.action },
    });
  }

  const allPerms = await prisma.permission.findMany();
  const keyToId = Object.fromEntries(allPerms.map((p) => [p.key, p.id]));

  for (const [role, keys] of Object.entries(ROLE_DEFAULTS)) {
    for (const key of keys) {
      const permId = keyToId[key];
      if (!permId) continue;
      const existing = await prisma.rolePermission.findUnique({
        where: { role_permissionId: { role, permissionId: permId } },
      });
      if (!existing) {
        await prisma.rolePermission.create({ data: { role, permissionId: permId } });
      }
    }
  }
}

/**
 * Migrates legacy role values (phd, msc, student) from User.role to
 * AcademicProfile.program while normalizing User.role to system roles.
 */
export async function migrateRoles() {
  const legacyMap: Record<string, { newRole: string; program: string }> = {
    phd: { newRole: "researcher", program: "phd" },
    msc: { newRole: "researcher", program: "msc" },
    student: { newRole: "contributor", program: "student" },
  };

  for (const [oldRole, { newRole, program }] of Object.entries(legacyMap)) {
    const users = await prisma.user.findMany({ where: { role: oldRole } });
    for (const user of users) {
      await prisma.user.update({ where: { id: user.id }, data: { role: newRole } });
      const existing = await prisma.academicProfile.findUnique({ where: { userId: user.id } });
      if (existing) {
        await prisma.academicProfile.update({ where: { userId: user.id }, data: { program } });
      } else {
        await prisma.academicProfile.create({ data: { userId: user.id, program } });
      }
    }
  }
}
