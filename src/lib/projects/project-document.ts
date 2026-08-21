import "server-only";
import { prisma } from "@/lib/db";
import { parseConops } from "@/lib/artifacts/schema";
import { formatDate } from "@/lib/utils";
import { formatProfilesLabel, legacyRoleToProfiles, normalizeProfiles } from "@/lib/profile-meta";
import type { ProjectReportConfig, ProjectReportData } from "@/lib/projects/project-document-types";
import { normalizeReportConfig } from "@/lib/projects/project-document-types";

const STATUS_LABELS: Record<string, string> = {
  active: "Ativo",
  paused: "Pausado",
  archived: "Arquivado",
  planned: "Planejada",
  in_progress: "Em andamento",
  done: "Concluida",
  blocked: "Bloqueada",
  backlog: "Backlog",
  todo: "A fazer",
  review: "Revisao",
  pending: "Pendente",
  submitted: "Submetido",
  accepted: "Aceito",
  rejected: "Rejeitado",
  proposed: "Proposto",
  approved: "Aprovado",
  upcoming: "Proximo",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "Baixa",
  medium: "Media",
  high: "Alta",
  urgent: "Urgente",
};

function label(map: Record<string, string>, value: string) {
  return map[value] ?? value;
}

export function reportStatusLabel(value: string) {
  return label(STATUS_LABELS, value);
}

export function reportPriorityLabel(value: string) {
  return label(PRIORITY_LABELS, value);
}

export function reportLabel(map: Record<string, string>, value: string) {
  return label(map, value);
}

function mdEscape(text: string) {
  return text.replace(/\|/g, "\\|").replace(/\n/g, " ").trim();
}

export function filterReportIds<T extends { id: string }>(items: T[], selected: string[] | undefined) {
  const ids = selected ?? [];
  if (ids.length === 0) return items;
  const set = new Set(ids);
  return items.filter((i) => set.has(i.id));
}

function filterIds<T extends { id: string }>(items: T[], selected: string[] | undefined) {
  return filterReportIds(items, selected);
}

export async function fetchProjectReportData(projectId: string): Promise<ProjectReportData> {
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    include: {
      memberships: { include: { user: { include: { profiles: { select: { profile: true } } } } } },
      workPackages: { orderBy: [{ order: "asc" }, { name: "asc" }] },
      deliverables: { include: { workPackage: { select: { code: true } } }, orderBy: { name: "asc" } },
      requirements: { orderBy: [{ code: "asc" }, { title: "asc" }] },
      milestones: { orderBy: { date: "asc" } },
      sprints: { orderBy: { createdAt: "desc" } },
    },
  });

  const tasks = await prisma.task.findMany({
    where: { projectId },
    include: {
      assignees: { select: { name: true } },
      sprint: { select: { name: true } },
      workPackage: { select: { code: true } },
    },
    orderBy: [{ order: "asc" }, { title: "asc" }],
  });

  const docTitlePrefix = `${project.key} — Documentacao`;
  const knowledgeArticle = await prisma.knowledgeArticle.findFirst({
    where: { projectId, title: { startsWith: docTitlePrefix } },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true },
  });

  return {
    project: {
      id: project.id,
      key: project.key,
      name: project.name,
      description: project.description,
      status: project.status,
      color: project.color,
      kind: project.kind,
    },
    conops: parseConops(project.conops),
    members: project.memberships.map((m) => {
      const profiles = m.user.profiles.length
        ? normalizeProfiles(m.user.profiles.map((p) => p.profile))
        : legacyRoleToProfiles(m.user.role);
      return {
        name: m.user.name,
        role: m.role,
        profilesLabel: formatProfilesLabel(profiles),
      };
    }),
    workPackages: project.workPackages.map((w) => ({
      id: w.id,
      parentId: w.parentId,
      code: w.code,
      name: w.name,
      description: w.description,
      status: w.status,
      order: w.order,
    })),
    deliverables: project.deliverables.map((d) => ({
      id: d.id,
      workPackageId: d.workPackageId,
      workPackageCode: d.workPackage?.code ?? null,
      name: d.name,
      description: d.description,
      acceptance: d.acceptance,
      status: d.status,
      dueDate: d.dueDate?.toISOString() ?? null,
    })),
    requirements: project.requirements.map((r) => ({
      id: r.id,
      code: r.code,
      title: r.title,
      description: r.description,
      status: r.status,
      priority: r.priority,
      kind: r.kind,
    })),
    milestones: project.milestones.map((m) => ({
      id: m.id,
      name: m.name,
      description: m.description,
      status: m.status,
      date: m.date?.toISOString() ?? null,
      gate: m.gate,
    })),
    tasks: tasks.map((t) => ({
      id: t.id,
      workPackageId: t.workPackageId,
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      estimate: t.estimate,
      dueDate: t.dueDate?.toISOString() ?? null,
      assignees: t.assignees.map((a) => a.name).join(", ") || "—",
      sprintName: t.sprint?.name ?? null,
    })),
    sprints: project.sprints.map((s) => ({
      id: s.id,
      name: s.name,
      goal: s.goal,
      status: s.status,
      startDate: s.startDate?.toISOString() ?? null,
      endDate: s.endDate?.toISOString() ?? null,
    })),
    knowledgeArticleId: knowledgeArticle?.id ?? null,
    knowledgeArticleTitle: knowledgeArticle?.title ?? null,
  };
}

export function filteredReportTasks(data: ProjectReportData, config: ProjectReportConfig) {
  let tasks = filterIds(data.tasks, config.taskIds);
  if (!config.includeCompletedTasks) {
    tasks = tasks.filter((t) => t.status !== "done");
  }
  return tasks;
}

function filteredTasks(data: ProjectReportData, config: ProjectReportConfig) {
  return filteredReportTasks(data, config);
}

export function wbsRoots(packages: ProjectReportData["workPackages"]) {
  return packages
    .filter((w) => !w.parentId)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

export function wbsChildren(packages: ProjectReportData["workPackages"], parentId: string) {
  return packages
    .filter((w) => w.parentId === parentId)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

export function isWbsIncluded(id: string, config: ProjectReportConfig, packages: ProjectReportData["workPackages"]) {
  if (config.wbsIds.length === 0) return true;
  const set = new Set(config.wbsIds);
  if (set.has(id)) return true;
  let cur = packages.find((p) => p.id === id);
  while (cur?.parentId) {
    if (set.has(cur.parentId)) return true;
    cur = packages.find((p) => p.id === cur!.parentId);
  }
  return false;
}

function renderWbsNode(
  node: ProjectReportData["workPackages"][number],
  data: ProjectReportData,
  config: ProjectReportConfig,
  tasks: ProjectReportData["tasks"],
  depth: number,
  lines: string[],
  sectionNum: string,
) {
  if (!isWbsIncluded(node.id, config, data.workPackages)) return;

  const heading = "#".repeat(Math.min(depth + 3, 6));
  const code = node.code ? `${node.code} ` : "";
  lines.push(`${heading} ${sectionNum} ${code}${node.name}`);
  lines.push("");
  lines.push(`- **Status:** ${label(STATUS_LABELS, node.status)}`);
  if (node.description?.trim()) {
    lines.push(`- **Descricao:** ${node.description.trim()}`);
  }

  const nodeTasks = tasks.filter((t) => t.workPackageId === node.id);
  if (nodeTasks.length > 0) {
    lines.push("");
    lines.push("**Tarefas vinculadas**");
    lines.push("");
    lines.push("| Tarefa | Status | Prioridade | Responsaveis | Prazo |");
    lines.push("|--------|--------|------------|--------------|-------|");
    for (const t of nodeTasks) {
      lines.push(
        `| ${mdEscape(t.title)} | ${label(STATUS_LABELS, t.status)} | ${label(PRIORITY_LABELS, t.priority)} | ${mdEscape(t.assignees)} | ${t.dueDate ? formatDate(t.dueDate) : "—"} |`,
      );
      if (config.includeTaskDescriptions && t.description?.trim()) {
        lines.push(`| _${mdEscape(t.description)}_ | | | | |`);
      }
    }
  }

  const children = wbsChildren(data.workPackages, node.id).filter((c) =>
    isWbsIncluded(c.id, config, data.workPackages),
  );
  children.forEach((child, i) => {
    lines.push("");
    renderWbsNode(child, data, config, tasks, depth + 1, lines, `${sectionNum}.${i + 1}`);
  });
}

export function generateProjectDocumentMarkdown(
  data: ProjectReportData,
  configInput: ProjectReportConfig,
  generatedAt = new Date(),
): string {
  const config = normalizeReportConfig(configInput);
  const lines: string[] = [];
  const { project } = data;
  const tasks = filteredTasks(data, config);
  const deliverables = filterIds(data.deliverables, config.deliverableIds);
  const requirements = filterIds(data.requirements, config.requirementIds);
  const milestones = filterIds(data.milestones, config.milestoneIds);
  const sprints = filterIds(data.sprints, []);

  lines.push(`# ${project.name} (${project.key})`);
  lines.push("");
  lines.push(`> Documentacao consolidada do projeto · gerada em ${generatedAt.toLocaleString("pt-BR")} · LabFlow`);
  lines.push("");
  lines.push("---");
  lines.push("");

  if (config.sections.overview) {
    lines.push("## 1. Visao geral");
    lines.push("");
    lines.push(`- **Sigla:** ${project.key}`);
    lines.push(`- **Status:** ${label(STATUS_LABELS, project.status)}`);
    if (project.description?.trim()) {
      lines.push(`- **Descricao:** ${project.description.trim()}`);
    }
    lines.push(`- **Pacotes WBS:** ${data.workPackages.length}`);
    lines.push(`- **Entregaveis:** ${deliverables.length}`);
    lines.push(`- **Requisitos:** ${requirements.length}`);
    lines.push(`- **Tarefas (no escopo do relatorio):** ${tasks.length}`);
    lines.push("");
  }

  if (config.sections.conops) {
    const c = data.conops;
    lines.push("## 2. CONOPS — Conceito de operacoes");
    lines.push("");
    const fields: [string, string][] = [
      ["Missao", c.mission],
      ["Escopo", c.scope],
      ["Stakeholders", c.stakeholders],
      ["Ambiente operacional", c.operatingEnvironment],
      ["Conceito de operacoes", c.conceptOfOperations],
      ["Restricoes", c.constraints],
      ["Criterios de sucesso", c.successCriteria],
      ["Premissas", c.assumptions],
    ];
    for (const [title, value] of fields) {
      if (!value?.trim()) continue;
      lines.push(`### ${title}`);
      lines.push("");
      lines.push(value.trim());
      lines.push("");
    }
  }

  if (config.sections.team && data.members.length > 0) {
    lines.push("## 3. Equipe do projeto");
    lines.push("");
    lines.push("| Membro | Papel no projeto | Perfis |");
    lines.push("|--------|------------------|--------|");
    for (const m of data.members) {
      lines.push(`| ${mdEscape(m.name)} | ${mdEscape(m.role)} | ${mdEscape(m.profilesLabel)} |`);
    }
    lines.push("");
  }

  if (config.sections.wbs && data.workPackages.length > 0) {
    lines.push("## 4. Estrutura analitica do trabalho (WBS)");
    lines.push("");
    lines.push("Hierarquia de atividades com tarefas alinhadas por pacote de trabalho.");
    lines.push("");
    const roots = wbsRoots(data.workPackages).filter((w) => isWbsIncluded(w.id, config, data.workPackages));
    roots.forEach((root, i) => {
      renderWbsNode(root, data, config, tasks, 0, lines, `4.${i + 1}`);
      lines.push("");
    });

    const orphanTasks = tasks.filter((t) => !t.workPackageId);
    if (orphanTasks.length > 0) {
      lines.push("### Tarefas sem pacote WBS");
      lines.push("");
      lines.push("| Tarefa | Status | Prioridade | Responsaveis | Prazo |");
      lines.push("|--------|--------|------------|--------------|-------|");
      for (const t of orphanTasks) {
        lines.push(
          `| ${mdEscape(t.title)} | ${label(STATUS_LABELS, t.status)} | ${label(PRIORITY_LABELS, t.priority)} | ${mdEscape(t.assignees)} | ${t.dueDate ? formatDate(t.dueDate) : "—"} |`,
        );
      }
      lines.push("");
    }
  }

  if (config.sections.deliverables && deliverables.length > 0) {
    lines.push("## 5. Entregaveis");
    lines.push("");
    lines.push("| Entregavel | WBS | Status | Criterios de aceitacao | Prazo |");
    lines.push("|------------|-----|--------|------------------------|-------|");
    for (const d of deliverables) {
      lines.push(
        `| ${mdEscape(d.name)} | ${d.workPackageCode ?? "—"} | ${label(STATUS_LABELS, d.status)} | ${mdEscape(d.acceptance ?? "—")} | ${d.dueDate ? formatDate(d.dueDate) : "—"} |`,
      );
    }
    lines.push("");
  }

  if (config.sections.requirements && requirements.length > 0) {
    lines.push("## 6. Requisitos e objetivos");
    lines.push("");
    lines.push("| Codigo | Titulo | Tipo | Prioridade | Status |");
    lines.push("|--------|--------|------|------------|--------|");
    for (const r of requirements) {
      lines.push(
        `| ${r.code ?? "—"} | ${mdEscape(r.title)} | ${r.kind} | ${label(PRIORITY_LABELS, r.priority)} | ${label(STATUS_LABELS, r.status)} |`,
      );
    }
    lines.push("");
    for (const r of requirements.filter((x) => x.description?.trim())) {
      lines.push(`### ${r.code ? `${r.code} — ` : ""}${r.title}`);
      lines.push("");
      lines.push(r.description!.trim());
      lines.push("");
    }
  }

  if (config.sections.milestones && milestones.length > 0) {
    lines.push("## 7. Marcos e gates");
    lines.push("");
    lines.push("| Marco | Data | Gate | Status |");
    lines.push("|-------|------|------|--------|");
    for (const m of milestones) {
      lines.push(
        `| ${mdEscape(m.name)} | ${m.date ? formatDate(m.date) : "—"} | ${m.gate ?? "—"} | ${label(STATUS_LABELS, m.status)} |`,
      );
    }
    lines.push("");
  }

  if (config.sections.tasks) {
    lines.push("## 8. Plano de tarefas consolidado");
    lines.push("");
    lines.push("| Tarefa | WBS | Status | Prioridade | Estimativa | Responsaveis | Sprint | Prazo |");
    lines.push("|--------|-----|--------|------------|------------|--------------|--------|-------|");
    for (const t of tasks) {
      const wp = data.workPackages.find((w) => w.id === t.workPackageId);
      const wbsLabel = wp ? `${wp.code ?? ""} ${wp.name}`.trim() : "—";
      lines.push(
        `| ${mdEscape(t.title)} | ${mdEscape(wbsLabel)} | ${label(STATUS_LABELS, t.status)} | ${label(PRIORITY_LABELS, t.priority)} | ${t.estimate != null ? `${t.estimate}h` : "—"} | ${mdEscape(t.assignees)} | ${t.sprintName ?? "—"} | ${t.dueDate ? formatDate(t.dueDate) : "—"} |`,
      );
    }
    lines.push("");
  }

  if (config.sections.sprints && sprints.length > 0) {
    lines.push("## 9. Sprints");
    lines.push("");
    for (const s of sprints) {
      lines.push(`### ${s.name}`);
      lines.push("");
      lines.push(`- **Status:** ${label(STATUS_LABELS, s.status)}`);
      if (s.startDate || s.endDate) {
        lines.push(
          `- **Periodo:** ${s.startDate ? formatDate(s.startDate) : "?"} — ${s.endDate ? formatDate(s.endDate) : "?"}`,
        );
      }
      if (s.goal?.trim()) lines.push(`- **Objetivo:** ${s.goal.trim()}`);
      const sprintTasks = tasks.filter((t) => t.sprintName === s.name);
      if (sprintTasks.length > 0) {
        lines.push(`- **Tarefas:** ${sprintTasks.length}`);
      }
      lines.push("");
    }
  }

  lines.push("---");
  lines.push("");
  lines.push(`_Documento gerado automaticamente pelo LabFlow para o projeto **${project.key}**._`);

  return lines.join("\n");
}

export function knowledgeDocumentTitle(projectKey: string) {
  return `${projectKey} — Documentacao completa`;
}
