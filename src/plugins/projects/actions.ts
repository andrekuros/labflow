"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import {
  canWriteProject,
  canManageProject,
  canAssignProjectLead,
  hasPermission,
} from "@/lib/rbac";
import { emit } from "@/lib/events";
import { getPluginSettings, setPluginProjectSettings } from "@/plugins/registry";
import { applyProjectTemplate, type ProjectTemplateKey } from "@/plugins/projects/templates";
import { getBoardColumnsForProject } from "@/plugins/board/columns";
import {
  type ProjectKind,
  isProjectKind,
  defaultFeaturesForKind,
  serializeProjectFeatures,
  type ProjectFeatures,
} from "@/lib/projects/features";
import { serializeAcademicMeta, EMPTY_ACADEMIC_META } from "@/lib/projects/academic-meta";
import { serializePaperMeta, EMPTY_PAPER_META } from "@/lib/projects/paper-meta";

export async function createProject(input: {
  key: string;
  name: string;
  description?: string;
  color?: string;
  kind?: ProjectKind;
  features?: Partial<ProjectFeatures>;
}) {
  const session = await getSession();
  if (!session) throw new Error("Nao autenticado");

  const settings = getPluginSettings("projects");
  const maxKeyLength = Number(settings.maxKeyLength ?? 8);
  const kind: ProjectKind = input.kind && isProjectKind(input.kind) ? input.kind : "lab";
  const features = {
    ...defaultFeaturesForKind(kind),
    ...(input.features ?? {}),
  };

  const project = await prisma.project.create({
    data: {
      key: input.key.toUpperCase().slice(0, maxKeyLength),
      name: input.name,
      description: input.description || null,
      color: input.color || String(settings.defaultColor ?? "#6366f1"),
      kind,
      featuresJson: serializeProjectFeatures(features),
      academicJson: serializeAcademicMeta({ ...EMPTY_ACADEMIC_META }),
      paperJson: serializePaperMeta({ ...EMPTY_PAPER_META }),
      memberships: { create: { userId: session.id, role: "lead" } },
    },
  });

  await emit({ type: "project.created", actorId: session.id, projectId: project.id, targetId: project.id, payload: { id: project.id, name: project.name } });
  await emit({ type: "project.updated", actorId: session.id, projectId: project.id, targetId: project.id, payload: { id: project.id } });
  revalidatePath("/projects");
  return project;
}

export async function createProjectFromTemplate(
  template: ProjectTemplateKey,
  input: {
    key: string;
    name: string;
    description?: string;
    color?: string;
    kind?: ProjectKind;
    features?: Partial<ProjectFeatures>;
  },
) {
  const kind = input.kind ?? (template === "admin" ? "admin" : "lab");
  if (template === "blank") return createProject({ ...input, kind });

  const project = await createProject({ ...input, kind });
  await applyProjectTemplate(project.id, template, input);
  revalidatePath("/projects");
  revalidatePath(`/projects/${project.id}`);
  return project;
}

export async function updateProjectFeatures(
  projectId: string,
  features: ProjectFeatures,
): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session) return { error: "Nao autenticado" };
  if (!(await canManageProject(session, projectId))) return { error: "Sem permissao" };

  await prisma.project.update({
    where: { id: projectId },
    data: { featuresJson: serializeProjectFeatures(features) },
  });
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/", "layout");
  return {};
}

export async function updateProjectAcademicMeta(
  projectId: string,
  meta: Parameters<typeof serializeAcademicMeta>[0],
): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session) return { error: "Nao autenticado" };
  if (!(await canWriteProject(session, projectId))) return { error: "Sem permissao" };
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { kind: true } });
  if (!project || (project.kind !== "thesis" && project.kind !== "dissertation")) {
    return { error: "Projeto nao e tese/dissertacao" };
  }
  await prisma.project.update({
    where: { id: projectId },
    data: { academicJson: serializeAcademicMeta(meta) },
  });
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/thesis");
  return {};
}

export async function updateProjectPaperMeta(
  projectId: string,
  meta: Parameters<typeof serializePaperMeta>[0],
): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session) return { error: "Nao autenticado" };
  if (!(await canWriteProject(session, projectId))) return { error: "Sem permissao" };
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { kind: true } });
  if (!project || project.kind !== "paper") return { error: "Projeto nao e artigo" };
  await prisma.project.update({
    where: { id: projectId },
    data: { paperJson: serializePaperMeta(meta) },
  });
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/papers");
  return {};
}

export async function addMember(input: { projectId: string; userId: string; role: string }) {
  const session = await getSession();
  if (!session) throw new Error("Nao autenticado");
  if (!(await canWriteProject(session, input.projectId))) throw new Error("Sem permissao");
  if (input.role === "lead" && !canAssignProjectLead(session)) {
    throw new Error("Apenas administradores podem designar lider do projeto.");
  }

  await prisma.projectMembership.upsert({
    where: { userId_projectId: { userId: input.userId, projectId: input.projectId } },
    update: { role: input.role },
    create: { userId: input.userId, projectId: input.projectId, role: input.role },
  });
  revalidatePath(`/projects/${input.projectId}`);
}

export async function updateMemberRole(membershipId: string, role: string) {
  const session = await getSession();
  if (!session) throw new Error("Nao autenticado");

  const membership = await prisma.projectMembership.findUnique({
    where: { id: membershipId },
    include: { project: { select: { id: true, key: true } } },
  });
  if (!membership) throw new Error("Membro nao encontrado.");
  if (!(await canManageProject(session, membership.projectId))) {
    throw new Error("Sem permissao para gerenciar a equipe.");
  }
  if (role === "lead" && !canAssignProjectLead(session)) {
    throw new Error("Apenas administradores podem designar lider do projeto.");
  }

  await prisma.projectMembership.update({
    where: { id: membershipId },
    data: { role },
  });
  revalidatePath(`/projects/${membership.projectId}`);
}

export async function removeMember(membershipId: string) {
  const session = await getSession();
  if (!session) throw new Error("Nao autenticado");

  const membership = await prisma.projectMembership.findUnique({
    where: { id: membershipId },
    include: { user: { select: { name: true } } },
  });
  if (!membership) throw new Error("Membro nao encontrado.");
  if (!(await canManageProject(session, membership.projectId))) {
    throw new Error("Sem permissao para gerenciar a equipe.");
  }
  if (membership.userId === session.id) {
    throw new Error("Voce nao pode remover a si mesmo. Peça a outro lider ou administrador.");
  }

  const leadCount = await prisma.projectMembership.count({
    where: { projectId: membership.projectId, role: "lead" },
  });
  if (membership.role === "lead" && leadCount <= 1) {
    throw new Error("Nao e possivel remover o unico lider do projeto.");
  }

  await prisma.projectMembership.delete({ where: { id: membershipId } });
  revalidatePath(`/projects/${membership.projectId}`);
}

export async function updateProject(
  projectId: string,
  input: {
    key?: string;
    name?: string;
    description?: string;
    color?: string;
    status?: string;
  },
) {
  const session = await getSession();
  if (!session) throw new Error("Nao autenticado");
  if (!(await canManageProject(session, projectId))) throw new Error("Sem permissao");

  const settings = getPluginSettings("projects");
  const maxKeyLength = Number(settings.maxKeyLength ?? 8);
  const data: {
    key?: string;
    name?: string;
    description?: string | null;
    color?: string;
    status?: string;
  } = {};

  if (input.key !== undefined) {
    const key = input.key.trim().toUpperCase().slice(0, maxKeyLength);
    if (!key) throw new Error("Sigla invalida.");
    const taken = await prisma.project.findFirst({
      where: { key, NOT: { id: projectId } },
    });
    if (taken) throw new Error("Esta sigla ja esta em uso.");
    data.key = key;
  }

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new Error("Nome nao pode ficar vazio.");
    data.name = name;
  }

  if (input.description !== undefined) {
    data.description = input.description.trim() || null;
  }

  if (input.color !== undefined) data.color = input.color;
  if (input.status !== undefined) {
    const allowed = ["active", "paused", "archived"];
    if (!allowed.includes(input.status)) throw new Error("Status invalido.");
    data.status = input.status;
  }

  if (Object.keys(data).length === 0) return;

  await prisma.project.update({ where: { id: projectId }, data });
  await emit({
    type: "project.updated",
    actorId: session.id,
    projectId,
    targetId: projectId,
    payload: { id: projectId, ...data },
  });
  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/board");
}

export async function saveProjectBoardSettings(projectId: string, columns: unknown) {
  const session = await getSession();
  if (!session) throw new Error("Nao autenticado");
  if (!(await canManageProject(session, projectId))) throw new Error("Sem permissao");
  if (!Array.isArray(columns) || columns.some((c) => typeof c !== "string")) {
    throw new Error("Colunas do Kanban invalidas.");
  }

  await setPluginProjectSettings("board", projectId, { columns });
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/board");
}

export async function getProjectBoardSettings(projectId: string) {
  return getBoardColumnsForProject(projectId);
}

export async function deleteProject(projectId: string, confirmKey: string) {
  const session = await getSession();
  if (!session) throw new Error("Nao autenticado");

  const allowed = await hasPermission(session, "project:delete", projectId);
  if (!allowed) throw new Error("Sem permissao para excluir este projeto.");

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new Error("Projeto nao encontrado.");

  if (confirmKey.trim().toUpperCase() !== project.key) {
    throw new Error(`Digite a sigla "${project.key}" para confirmar a exclusao.`);
  }

  await emit({
    type: "project.updated",
    actorId: session.id,
    projectId,
    targetId: projectId,
    payload: { id: projectId, deleted: true, key: project.key, name: project.name },
  });

  await prisma.project.delete({ where: { id: projectId } });
  revalidatePath("/projects");
  revalidatePath("/board");
  redirect("/projects");
}

export async function createLabel(input: { projectId: string; name: string; color: string }) {
  const session = await getSession();
  if (!session) throw new Error("Nao autenticado");
  if (!(await canWriteProject(session, input.projectId))) throw new Error("Sem permissao");
  const label = await prisma.label.create({ data: input });
  revalidatePath(`/projects/${input.projectId}`);
  revalidatePath("/board");
  return label;
}

export async function createWorkPackage(input: {
  projectId: string;
  name: string;
  code?: string;
  parentId?: string | null;
  description?: string;
}) {
  const session = await getSession();
  if (!session) throw new Error("Nao autenticado");
  if (!(await canWriteProject(session, input.projectId))) throw new Error("Sem permissao");
  const { requireProjectFeature } = await import("@/lib/projects/features-server");
  const feat = await requireProjectFeature(input.projectId, "wbs");
  if (feat.error) throw new Error(feat.error);
  const count = await prisma.workPackage.count({ where: { projectId: input.projectId, parentId: input.parentId ?? null } });
  await prisma.workPackage.create({
    data: {
      projectId: input.projectId,
      name: input.name,
      code: input.code || null,
      parentId: input.parentId || null,
      description: input.description || null,
      order: count,
    },
  });
  revalidatePath(`/projects/${input.projectId}`);
}

export async function updateWorkPackage(
  workPackageId: string,
  input: {
    name?: string;
    code?: string | null;
    description?: string | null;
    status?: string;
    parentId?: string | null;
  },
): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session) return { error: "Nao autenticado" };

  const wp = await prisma.workPackage.findUnique({ where: { id: workPackageId } });
  if (!wp) return { error: "Pacote WBS nao encontrado" };
  if (!(await canWriteProject(session, wp.projectId))) return { error: "Sem permissao" };

  const data: {
    name?: string;
    code?: string | null;
    description?: string | null;
    status?: string;
    parentId?: string | null;
    order?: number;
  } = {};

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) return { error: "Nome obrigatorio" };
    data.name = name;
  }
  if (input.code !== undefined) data.code = input.code?.trim() || null;
  if (input.description !== undefined) data.description = input.description?.trim() || null;
  if (input.status !== undefined) {
    const allowed = ["planned", "in_progress", "done", "blocked"];
    if (!allowed.includes(input.status)) return { error: "Status invalido" };
    data.status = input.status;
  }

  if (input.parentId !== undefined) {
    const newParentId = input.parentId || null;
    if (newParentId === workPackageId) return { error: "Um pacote nao pode ser pai de si mesmo" };

    if (newParentId) {
      const parent = await prisma.workPackage.findFirst({
        where: { id: newParentId, projectId: wp.projectId },
      });
      if (!parent) return { error: "Pacote pai invalido" };

      const all = await prisma.workPackage.findMany({
        where: { projectId: wp.projectId },
        select: { id: true, parentId: true },
      });
      const descendants = collectDescendantIds(workPackageId, all);
      if (descendants.has(newParentId)) return { error: "Nao e possivel mover para um subpacote" };
    }

    if (newParentId !== wp.parentId) {
      const count = await prisma.workPackage.count({
        where: { projectId: wp.projectId, parentId: newParentId },
      });
      data.parentId = newParentId;
      data.order = count;
    }
  }

  if (Object.keys(data).length === 0) return {};

  await prisma.workPackage.update({ where: { id: workPackageId }, data });
  revalidatePath(`/projects/${wp.projectId}`);
  return {};
}

export async function deleteWorkPackage(workPackageId: string): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session) return { error: "Nao autenticado" };

  const wp = await prisma.workPackage.findUnique({ where: { id: workPackageId } });
  if (!wp) return { error: "Pacote WBS nao encontrado" };
  if (!(await canWriteProject(session, wp.projectId))) return { error: "Sem permissao" };

  await prisma.workPackage.delete({ where: { id: workPackageId } });
  revalidatePath(`/projects/${wp.projectId}`);
  return {};
}

export async function moveWorkPackage(
  workPackageId: string,
  direction: "up" | "down",
): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session) return { error: "Nao autenticado" };

  const wp = await prisma.workPackage.findUnique({ where: { id: workPackageId } });
  if (!wp) return { error: "Pacote WBS nao encontrado" };
  if (!(await canWriteProject(session, wp.projectId))) return { error: "Sem permissao" };

  const siblings = await prisma.workPackage.findMany({
    where: { projectId: wp.projectId, parentId: wp.parentId },
    orderBy: [{ order: "asc" }, { name: "asc" }],
  });

  const index = siblings.findIndex((s) => s.id === workPackageId);
  if (index === -1) return { error: "Pacote nao encontrado entre irmaos" };

  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= siblings.length) return {};

  const reordered = [...siblings];
  [reordered[index], reordered[swapIndex]] = [reordered[swapIndex], reordered[index]];

  await prisma.$transaction(
    reordered.map((sibling, i) =>
      prisma.workPackage.update({ where: { id: sibling.id }, data: { order: i } }),
    ),
  );

  revalidatePath(`/projects/${wp.projectId}`);
  return {};
}

function collectDescendantIds(
  rootId: string,
  nodes: { id: string; parentId: string | null }[],
): Set<string> {
  const ids = new Set<string>();
  const walk = (parentId: string) => {
    for (const node of nodes) {
      if (node.parentId === parentId && !ids.has(node.id)) {
        ids.add(node.id);
        walk(node.id);
      }
    }
  };
  walk(rootId);
  return ids;
}

export async function updateProjectTaskFields(input: {
  taskId: string;
  workPackageId?: string | null;
  estimate?: number | null;
}): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session) return { error: "Nao autenticado" };

  const task = await prisma.task.findUnique({ where: { id: input.taskId } });
  if (!task) return { error: "Tarefa nao encontrada" };
  if (!(await canWriteProject(session, task.projectId))) return { error: "Sem permissao" };

  const data: { workPackageId?: string | null; estimate?: number | null } = {};
  if (input.workPackageId !== undefined) data.workPackageId = input.workPackageId || null;
  if (input.estimate !== undefined) {
    data.estimate = input.estimate == null || Number.isNaN(input.estimate) ? null : input.estimate;
  }

  if (Object.keys(data).length === 0) return {};

  const updated = await prisma.task.update({
    where: { id: input.taskId },
    data,
  });

  await emit({
    type: "task.updated",
    actorId: session.id,
    projectId: task.projectId,
    targetId: task.id,
    payload: { id: task.id, title: updated.title },
  });

  revalidatePath(`/projects/${task.projectId}`);
  revalidatePath("/board");
  return {};
}

export async function mapTasksToWbsWithAiAction(
  projectId: string,
  opts?: { onlyUnmapped?: boolean },
): Promise<{ error?: string; created?: number }> {
  const session = await getSession();
  if (!session) return { error: "Nao autenticado" };
  if (!(await canWriteProject(session, projectId))) return { error: "Sem permissao" };

  const { aiEnabled } = await import("@/lib/ai/provider");
  if (!(await aiEnabled())) return { error: "IA nao configurada. Ajuste em Configuracoes." };

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return { error: "Projeto nao encontrado" };

  const [workPackages, tasks] = await Promise.all([
    prisma.workPackage.findMany({
      where: { projectId },
      orderBy: [{ order: "asc" }],
      select: { id: true, code: true, name: true, parentId: true },
    }),
    prisma.task.findMany({
      where: {
        projectId,
        ...(opts?.onlyUnmapped !== false ? { workPackageId: null } : {}),
      },
      select: { id: true, title: true, description: true, status: true, estimate: true },
      orderBy: { title: "asc" },
    }),
  ]);

  if (workPackages.length === 0) return { error: "Crie pacotes WBS antes de mapear tarefas." };
  if (tasks.length === 0) return { error: "Nenhuma tarefa para mapear." };

  try {
    const { mapTasksToWbsWithAi } = await import("@/lib/ai/wbs-task-mapper");
    const result = await mapTasksToWbsWithAi({
      projectName: project.name,
      workPackages,
      tasks,
    });

    const taskMap = new Map(tasks.map((t) => [t.id, t]));
    let created = 0;

    for (const mapping of result.taskMappings) {
      const task = taskMap.get(mapping.taskId);
      if (!task) continue;

      await prisma.aiDraft.create({
        data: {
          projectId,
          artifactType: "task",
          title: `WBS: ${task.title}`.slice(0, 120),
          payload: JSON.stringify({
            taskId: mapping.taskId,
            title: task.title,
            description: task.description,
            status: task.status,
            workPackageCode: mapping.workPackageCode,
            estimate: mapping.estimate,
            rationale: mapping.rationale,
          }),
          source: "ai",
          createdBy: session.id,
        },
      });
      created += 1;
    }

    if (created === 0) return { error: "IA nao gerou mapeamentos validos." };
    revalidatePath(`/projects/${projectId}`);
    return { created };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao mapear com IA" };
  }
}
