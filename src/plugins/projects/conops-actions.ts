"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canWriteProject, canViewProject } from "@/lib/rbac";
import { aiEnabled } from "@/lib/ai/provider";
import { generateArtifactsFromConops, type GenerationMode } from "@/lib/ai/conops-generator";
import { exportProjectArtifacts } from "@/lib/artifacts/export";
import { importArtifactsAsDrafts, parseArtifactsJson } from "@/lib/artifacts/import";
import { acceptAiDraft, createDraftsFromBundle, deleteAiDraft, deletePendingAiDrafts } from "@/lib/artifacts/accept-draft";
import { emit } from "@/lib/events";
import { parseConops, type ConopsData, type ArtifactType } from "@/lib/artifacts/schema";
import {
  collectExistingKeys,
  getExistingArtifactSummary,
  type ArtifactCounts,
} from "@/lib/artifacts/existing-summary";
import { filterNewArtifacts } from "@/lib/artifacts/dedupe-drafts";
import { generateTasksFromMarkdown } from "@/lib/ai/markdown-task-generator";

async function requireWrite(projectId: string) {
  const session = await getSession();
  if (!session) throw new Error("Nao autenticado");
  if (!(await canWriteProject(session, projectId))) throw new Error("Sem permissao");
  return session;
}

export async function saveConops(projectId: string, data: ConopsData) {
  await requireWrite(projectId);
  await prisma.project.update({
    where: { id: projectId },
    data: { conops: JSON.stringify(data) },
  });
  await emit({ type: "project.updated", projectId, targetId: projectId, payload: { id: projectId } });
  revalidatePath(`/projects/${projectId}`);
}

export type GenerateResult = {
  created: number;
  skipped: number;
  rejectedPending: number;
};

export async function getArtifactCounts(projectId: string): Promise<ArtifactCounts> {
  const { counts } = await getExistingArtifactSummary(projectId);
  return counts;
}

export async function generateArtifactsWithAi(
  projectId: string,
  types: ArtifactType[],
  mode: GenerationMode = "complement",
): Promise<GenerateResult> {
  const session = await requireWrite(projectId);
  if (!(await aiEnabled())) throw new Error("IA nao configurada. Va em Configuracoes.");

  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  const conops = parseConops(project.conops);
  if (!conops.mission.trim() && !conops.conceptOfOperations.trim()) {
    throw new Error("Preencha ao menos Missao ou Conceito de operacoes no CONOPS");
  }

  let rejectedPending = 0;
  if (mode === "replace_pending") {
    rejectedPending = await deletePendingAiDrafts({ projectId, artifactTypes: types });
  }

  const summary = await getExistingArtifactSummary(projectId);
  const pending = await prisma.aiDraft.findMany({
    where: { projectId, status: "pending" },
    select: { artifactType: true, payload: true },
  });

  const [requirements, tasks, deliverables, workPackages, milestones, systemElements, verificationCases] =
    await Promise.all([
      prisma.requirement.findMany({ where: { projectId }, select: { code: true, title: true } }),
      prisma.task.findMany({ where: { projectId }, select: { title: true } }),
      prisma.deliverable.findMany({ where: { projectId }, select: { name: true } }),
      prisma.workPackage.findMany({ where: { projectId }, select: { code: true, name: true } }),
      prisma.milestone.findMany({ where: { projectId }, select: { name: true } }),
      prisma.systemElement.findMany({ where: { projectId }, select: { name: true } }),
      prisma.verificationCase.findMany({ where: { projectId }, select: { name: true } }),
    ]);

  const existingKeys =
    mode === "append"
      ? new Set<string>()
      : collectExistingKeys(summary, pending, {
          requirements,
          tasks,
          deliverables,
          workPackages,
          milestones,
          systemElements,
          verificationCases,
        });

  const existingLines = mode === "append" ? [] : summary.lines;
  let bundle = await generateArtifactsFromConops(conops, project.name, types, existingLines, mode);

  let skipped = 0;
  if (mode !== "append") {
    const filtered = filterNewArtifacts(bundle, existingKeys, types);
    bundle = filtered.bundle;
    skipped = filtered.skipped;
  }

  const created = await createDraftsFromBundle(projectId, bundle, "ai", session.id);
  revalidatePath(`/projects/${projectId}`);
  return { created, skipped, rejectedPending };
}

export async function exportProjectJson(projectId: string) {
  const session = await getSession();
  if (!session) throw new Error("Nao autenticado");
  if (!(await canViewProject(session, projectId))) throw new Error("Sem permissao");
  const bundle = await exportProjectArtifacts(projectId);
  return JSON.stringify(bundle, null, 2);
}

export async function importProjectJson(projectId: string, raw: string, applyConops = true) {
  const session = await requireWrite(projectId);
  const bundle = parseArtifactsJson(raw);
  const count = await importArtifactsAsDrafts(projectId, raw, session.id);

  if (applyConops && bundle.conops) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    const current = parseConops(project?.conops);
    await prisma.project.update({
      where: { id: projectId },
      data: { conops: JSON.stringify({ ...current, ...bundle.conops }) },
    });
  }

  revalidatePath(`/projects/${projectId}`);
  return count;
}

export async function generateTasksFromMarkdownAction(
  projectId: string,
  markdown: string,
): Promise<GenerateResult> {
  const session = await requireWrite(projectId);
  if (!(await aiEnabled())) throw new Error("IA nao configurada. Va em Configuracoes.");

  const text = markdown.trim();
  if (!text) throw new Error("Cole ou envie um arquivo Markdown com o conteudo a processar.");

  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  const existingTasks = await prisma.task.findMany({
    where: { projectId },
    select: { title: true },
  });
  const pending = await prisma.aiDraft.findMany({
    where: { projectId, status: "pending", artifactType: "task" },
    select: { artifactType: true, payload: true },
  });

  const existingTitles = [
    ...existingTasks.map((t) => t.title),
    ...pending.map((d) => {
      try {
        const p = JSON.parse(d.payload) as { title?: string };
        return p.title ?? "";
      } catch {
        return "";
      }
    }),
  ].filter(Boolean);

  let bundle = await generateTasksFromMarkdown(text, project.name, existingTitles);
  const summary = await getExistingArtifactSummary(projectId);
  const existingKeys = collectExistingKeys(summary, pending, {
    requirements: [],
    tasks: existingTasks,
    deliverables: [],
    workPackages: [],
    milestones: [],
    systemElements: [],
    verificationCases: [],
  });

  const filtered = filterNewArtifacts(
    { version: bundle.version, exportedAt: new Date().toISOString(), tasks: bundle.tasks },
    existingKeys,
    ["task"],
  );
  bundle = filtered.bundle;
  const skipped = filtered.skipped;

  const created = await createDraftsFromBundle(projectId, { tasks: bundle.tasks }, "ai", session.id);
  revalidatePath(`/projects/${projectId}`);
  return { created, skipped, rejectedPending: 0 };
}

export async function acceptDraft(draftId: string, projectId: string) {
  const session = await requireWrite(projectId);
  await acceptAiDraft(draftId, session.id);
  revalidatePath(`/projects/${projectId}`);
}

export async function acceptDraftsBulk(draftIds: string[], projectId: string) {
  const session = await requireWrite(projectId);
  for (const draftId of draftIds) {
    await acceptAiDraft(draftId, session.id);
  }
  revalidatePath(`/projects/${projectId}`);
}

export async function rejectDraft(draftId: string, projectId: string) {
  await requireWrite(projectId);
  await deleteAiDraft(draftId, projectId);
  revalidatePath(`/projects/${projectId}`);
}

export async function rejectDraftsBulk(draftIds: string[], projectId: string) {
  await requireWrite(projectId);
  await deletePendingAiDrafts({ projectId, ids: draftIds });
  revalidatePath(`/projects/${projectId}`);
}

export async function updateDraftPayload(draftId: string, projectId: string, payload: string) {
  await requireWrite(projectId);
  JSON.parse(payload);
  const data = JSON.parse(payload) as Record<string, unknown>;
  const title = String(data.title ?? data.name ?? data.code ?? "Artefato");
  await prisma.aiDraft.update({
    where: { id: draftId },
    data: { payload, title: title.slice(0, 120) },
  });
  revalidatePath(`/projects/${projectId}`);
}
