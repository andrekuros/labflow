import "server-only";
import { prisma } from "@/lib/db";
import { ingest } from "@/lib/ai/rag";
import { parseConops } from "@/lib/artifacts/schema";

export async function indexUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      memberships: { include: { project: { select: { key: true, name: true } } } },
      academicProfile: true,
    },
  });
  if (!user) return;

  const projects = user.memberships.map((m) => `${m.project.key} ${m.project.name} (${m.role})`).join(", ");
  const academic = user.academicProfile;
  const academicText = academic
    ? [
        `Programa: ${academic.program}`,
        `Motivacao: ${academic.motivation}`,
        `Objetivo: ${academic.objective}`,
        `Problema: ${academic.problemStatement}`,
        `Contribuicao: ${academic.academicContribution}`,
        `Resultado esperado: ${academic.expectedResults}`,
      ]
        .filter((l) => l.split(": ")[1]?.trim())
        .join("\n")
    : "";

  const text = [
    `Usuario: ${user.name}`,
    `Email: ${user.email}`,
    `Papel: ${user.role}`,
    user.title ? `Titulo: ${user.title}` : "",
    projects ? `Projetos: ${projects}` : "",
    academicText,
  ]
    .filter(Boolean)
    .join("\n");

  await ingest({ sourceType: "user", sourceId: user.id, projectId: null, text });
}

export async function indexProject(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      memberships: { include: { user: { select: { name: true, role: true, title: true } } } },
      _count: {
        select: { tasks: true, requirements: true, deliverables: true, workPackages: true },
      },
    },
  });
  if (!project) return;

  const conops = parseConops(project.conops);
  const team = project.memberships.map((m) => `${m.user.name} (${m.user.role})`).join(", ");

  const text = [
    `Projeto: ${project.key} — ${project.name}`,
    project.description ? `Descricao: ${project.description}` : "",
    `Status: ${project.status}`,
    `Tarefas: ${project._count.tasks}, Requisitos: ${project._count.requirements}, Entregaveis: ${project._count.deliverables}`,
    team ? `Equipe: ${team}` : "",
    conops.mission ? `Missao CONOPS: ${conops.mission}` : "",
    conops.scope ? `Escopo: ${conops.scope}` : "",
    conops.conceptOfOperations ? `Conceito de operacoes: ${conops.conceptOfOperations}` : "",
    conops.successCriteria ? `Criterios de sucesso: ${conops.successCriteria}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  await ingest({ sourceType: "project", sourceId: project.id, projectId: project.id, text });
}

export async function indexTask(taskId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      project: { select: { key: true, name: true } },
      workPackage: { select: { code: true, name: true } },
      assignees: { select: { name: true } },
      labels: { select: { name: true } },
    },
  });
  if (!task) return;

  const text = [
    `Tarefa: ${task.title}`,
    `Projeto: ${task.project.key} ${task.project.name}`,
    task.description ? `Descricao: ${task.description}` : "",
    `Status: ${task.status}, Prioridade: ${task.priority}`,
    task.workPackage ? `WBS: ${task.workPackage.code ?? ""} ${task.workPackage.name}` : "",
    task.assignees.length ? `Responsaveis: ${task.assignees.map((a) => a.name).join(", ")}` : "",
    task.labels.length ? `Categorias: ${task.labels.map((l) => l.name).join(", ")}` : "",
    task.dueDate ? `Prazo: ${task.dueDate.toISOString().slice(0, 10)}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  await ingest({ sourceType: "task", sourceId: task.id, projectId: task.projectId, text });
}

export async function indexAcademicProfile(userId: string) {
  const profile = await prisma.academicProfile.findUnique({
    where: { userId },
    include: { user: { select: { name: true, email: true, role: true, title: true } } },
  });
  if (!profile) return;

  let courses: { code?: string; name?: string; status?: string; grade?: string }[] = [];
  let pending: { title?: string; kind?: string; status?: string; dueDate?: string }[] = [];
  try {
    courses = JSON.parse(profile.coursesJson);
    pending = JSON.parse(profile.pendingJson);
  } catch {
    /* ignore */
  }

  const text = [
    `Acompanhamento academico: ${profile.user.name}`,
    `Programa: ${profile.program}, Status: ${profile.status}`,
    profile.motivation ? `Motivacao: ${profile.motivation}` : "",
    profile.objective ? `Objetivo: ${profile.objective}` : "",
    profile.problemStatement ? `Problema de pesquisa: ${profile.problemStatement}` : "",
    profile.hypothesis ? `Hipótese: ${profile.hypothesis}` : "",
    profile.methodology ? `Metodologia: ${profile.methodology}` : "",
    profile.academicContribution ? `Contribuicao academica: ${profile.academicContribution}` : "",
    profile.expectedResults ? `Resultado esperado: ${profile.expectedResults}` : "",
    profile.limitations ? `Limitacoes: ${profile.limitations}` : "",
    profile.theoreticalFramework ? `Referencial teorico: ${profile.theoreticalFramework}` : "",
    profile.advisorName ? `Orientador: ${profile.advisorName}` : "",
    courses.length
      ? `Disciplinas: ${courses.map((c) => `${c.code ?? ""} ${c.name ?? ""} [${c.status ?? ""}]`).join("; ")}`
      : "",
    pending.length
      ? `Pendencias: ${pending.map((p) => `${p.title ?? ""} (${p.kind ?? ""}) [${p.status ?? ""}]`).join("; ")}`
      : "",
    profile.notes ? `Notas: ${profile.notes}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  await ingest({ sourceType: "academic", sourceId: profile.id, projectId: null, text });
  await indexUser(userId);
}

const g = globalThis as unknown as { __labflowKnowledgeSynced?: boolean };

export async function ensureKnowledgeIndexed() {
  if (g.__labflowKnowledgeSynced) return;
  g.__labflowKnowledgeSynced = true;

  const [users, projects, tasks] = await Promise.all([
    prisma.user.findMany({ select: { id: true } }),
    prisma.project.findMany({ select: { id: true } }),
    prisma.task.findMany({ select: { id: true }, take: 500, orderBy: { updatedAt: "desc" } }),
  ]);

  for (const u of users) await indexUser(u.id).catch(() => {});
  for (const p of projects) await indexProject(p.id).catch(() => {});
  for (const t of tasks) await indexTask(t.id).catch(() => {});

  const profiles = await prisma.academicProfile.findMany({ select: { userId: true } });
  for (const p of profiles) await indexAcademicProfile(p.userId).catch(() => {});
}
