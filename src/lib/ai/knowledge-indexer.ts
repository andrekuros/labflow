import "server-only";
import { prisma } from "@/lib/db";
import { ingest, embeddingIndexStats } from "@/lib/ai/rag";
import { articleIngestText } from "@/lib/knowledge/files";
import { parseConops } from "@/lib/artifacts/schema";
import { parseChecklist } from "@/lib/task-checklist";

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
      memberships: { include: { user: { select: { name: true, role: true } } } },
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
    (() => {
      const steps = parseChecklist(task.checklistJson);
      return steps.length
        ? `Checklist: ${steps.map((s) => `${s.done ? "[x]" : "[ ]"} ${s.title}`).join("; ")}`
        : "";
    })(),
  ]
    .filter(Boolean)
    .join("\n");

  await ingest({ sourceType: "task", sourceId: task.id, projectId: task.projectId, text });
}

export async function indexAcademicProfile(userId: string) {
  const profile = await prisma.academicProfile.findUnique({
    where: { userId },
    include: { user: { select: { name: true, email: true, role: true } } },
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

export async function indexDeliverable(deliverableId: string) {
  const d = await prisma.deliverable.findUnique({ where: { id: deliverableId } });
  if (!d) return;
  const text = [d.name, d.description].filter(Boolean).join("\n");
  if (!text.trim()) return;
  await ingest({ sourceType: "deliverable", sourceId: d.id, projectId: d.projectId, text });
}

export async function indexRequirement(requirementId: string) {
  const r = await prisma.requirement.findUnique({ where: { id: requirementId } });
  if (!r) return;
  const text = [r.code, r.title, r.description].filter(Boolean).join("\n");
  if (!text.trim()) return;
  await ingest({ sourceType: "requirement", sourceId: r.id, projectId: r.projectId, text });
}

export async function indexArticle(articleId: string) {
  const article = await prisma.knowledgeArticle.findUnique({ where: { id: articleId } });
  if (!article) return;
  const text = articleIngestText(article);
  if (!text.trim()) return;
  await ingest({ sourceType: "article", sourceId: article.id, projectId: article.projectId, text });
}

/** Source types rebuilt by `reindexAll`. Others are only ingested from events. */
const REINDEXED_SOURCE_TYPES = [
  "article",
  "project",
  "task",
  "user",
  "academic",
  "deliverable",
  "requirement",
] as const;

export type ReindexProgress = { indexed: number; failed: number };

/**
 * Re-embed the whole corpus with the currently configured embedding model.
 *
 * Vectors are only comparable within one model, so switching provider or model
 * leaves the previous vectors unreadable to search. This is the remediation
 * path: it rebuilds everything and drops whatever is left from older models.
 */
export async function reindexAll(): Promise<ReindexProgress> {
  let indexed = 0;
  let failed = 0;

  const run = async (fn: () => Promise<void>) => {
    try {
      await fn();
      indexed++;
    } catch {
      failed++;
    }
  };

  const [users, projects, tasks, articles, profiles, deliverables, requirements] = await Promise.all([
    prisma.user.findMany({ select: { id: true } }),
    prisma.project.findMany({ select: { id: true } }),
    prisma.task.findMany({ select: { id: true } }),
    prisma.knowledgeArticle.findMany({ select: { id: true } }),
    prisma.academicProfile.findMany({ select: { userId: true } }),
    prisma.deliverable.findMany({ select: { id: true } }),
    prisma.requirement.findMany({ select: { id: true } }),
  ]);

  for (const a of articles) await run(() => indexArticle(a.id));
  for (const p of projects) await run(() => indexProject(p.id));
  for (const t of tasks) await run(() => indexTask(t.id));
  for (const u of users) await run(() => indexUser(u.id));
  for (const p of profiles) await run(() => indexAcademicProfile(p.userId));
  for (const d of deliverables) await run(() => indexDeliverable(d.id));
  for (const r of requirements) await run(() => indexRequirement(r.id));

  // Drop vectors left behind by an earlier model, but only for the types this
  // function actually rebuilds. Forum posts are ingested from events alone, so
  // deleting them here would remove content nothing would recreate.
  const { currentModel } = await embeddingIndexStats();
  await prisma.embedding.deleteMany({
    where: {
      sourceType: { in: [...REINDEXED_SOURCE_TYPES] },
      OR: [{ modelName: null }, { NOT: { modelName: currentModel } }],
    },
  });

  g.__labflowKnowledgeSynced = true;
  return { indexed, failed };
}

/**
 * Best-effort backfill on boot. Only runs when the store holds nothing for the
 * current embedding model — re-embedding an already-indexed corpus on every
 * restart is pure cost, and with a real provider it is slow enough to matter.
 */
export async function ensureKnowledgeIndexed() {
  if (g.__labflowKnowledgeSynced) return;
  g.__labflowKnowledgeSynced = true;

  const stats = await embeddingIndexStats().catch(() => null);
  if (stats && stats.current > 0) return;

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
