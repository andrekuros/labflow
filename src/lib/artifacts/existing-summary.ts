import "server-only";
import { prisma } from "@/lib/db";
import type { ArtifactType } from "@/lib/artifacts/schema";

export type ArtifactCounts = Record<ArtifactType, { accepted: number; pending: number }>;

export type ExistingArtifactSummary = {
  counts: ArtifactCounts;
  lines: string[];
};

const EMPTY_COUNTS = (): ArtifactCounts => ({
  requirement: { accepted: 0, pending: 0 },
  task: { accepted: 0, pending: 0 },
  deliverable: { accepted: 0, pending: 0 },
  work_package: { accepted: 0, pending: 0 },
  milestone: { accepted: 0, pending: 0 },
  system_element: { accepted: 0, pending: 0 },
  verification_case: { accepted: 0, pending: 0 },
  sprint_plan: { accepted: 0, pending: 0 },
});

export async function getExistingArtifactSummary(projectId: string): Promise<ExistingArtifactSummary> {
  const counts = EMPTY_COUNTS();
  const lines: string[] = [];

  const [
    requirements,
    tasks,
    deliverables,
    workPackages,
    milestones,
    systemElements,
    verificationCases,
    pendingDrafts,
  ] = await Promise.all([
    prisma.requirement.findMany({ where: { projectId }, select: { code: true, title: true } }),
    prisma.task.findMany({ where: { projectId }, select: { title: true } }),
    prisma.deliverable.findMany({ where: { projectId }, select: { name: true } }),
    prisma.workPackage.findMany({ where: { projectId }, select: { code: true, name: true } }),
    prisma.milestone.findMany({ where: { projectId }, select: { name: true } }),
    prisma.systemElement.findMany({ where: { projectId }, select: { name: true } }),
    prisma.verificationCase.findMany({ where: { projectId }, select: { name: true } }),
    prisma.aiDraft.findMany({ where: { projectId, status: "pending" }, select: { artifactType: true, title: true, payload: true } }),
  ]);

  counts.requirement.accepted = requirements.length;
  counts.task.accepted = tasks.length;
  counts.deliverable.accepted = deliverables.length;
  counts.work_package.accepted = workPackages.length;
  counts.milestone.accepted = milestones.length;
  counts.system_element.accepted = systemElements.length;
  counts.verification_case.accepted = verificationCases.length;

  for (const d of pendingDrafts) {
    const t = d.artifactType as ArtifactType;
    if (counts[t]) counts[t].pending += 1;
  }

  for (const r of requirements.slice(0, 30)) {
    lines.push(`requisito: ${r.code ? r.code + " — " : ""}${r.title}`);
  }
  for (const t of tasks.slice(0, 20)) lines.push(`tarefa: ${t.title}`);
  for (const d of deliverables.slice(0, 15)) lines.push(`entregavel: ${d.name}`);
  for (const w of workPackages.slice(0, 15)) {
    lines.push(`wbs: ${w.code ? w.code + " " : ""}${w.name}`);
  }
  for (const m of milestones.slice(0, 10)) lines.push(`marco: ${m.name}`);
  for (const s of systemElements.slice(0, 10)) lines.push(`elemento: ${s.name}`);
  for (const v of verificationCases.slice(0, 10)) lines.push(`vv: ${v.name}`);
  for (const d of pendingDrafts.slice(0, 15)) lines.push(`rascunho pendente (${d.artifactType}): ${d.title}`);

  return { counts, lines };
}

export function artifactKey(type: ArtifactType, data: Record<string, unknown>): string {
  const code = String(data.code ?? "").trim().toLowerCase();
  const title = String(data.title ?? data.name ?? "").trim().toLowerCase();
  if (type === "requirement" && code) return `req:${code}`;
  return `${type}:${title}`;
}

export function collectExistingKeys(
  summary: ExistingArtifactSummary,
  pendingPayloads: { artifactType: string; payload: string }[],
  accepted: {
    requirements: { code: string | null; title: string }[];
    tasks: { title: string }[];
    deliverables: { name: string }[];
    workPackages: { code: string | null; name: string }[];
    milestones: { name: string }[];
    systemElements: { name: string }[];
    verificationCases: { name: string }[];
  },
): Set<string> {
  const keys = new Set<string>();
  for (const r of accepted.requirements) {
    if (r.code) keys.add(`req:${r.code.trim().toLowerCase()}`);
    keys.add(`requirement:${r.title.trim().toLowerCase()}`);
  }
  for (const t of accepted.tasks) keys.add(`task:${t.title.trim().toLowerCase()}`);
  for (const d of accepted.deliverables) keys.add(`deliverable:${d.name.trim().toLowerCase()}`);
  for (const w of accepted.workPackages) {
    if (w.code) keys.add(`work_package:${w.code.trim().toLowerCase()}:${w.name.trim().toLowerCase()}`);
    keys.add(`work_package:${w.name.trim().toLowerCase()}`);
  }
  for (const m of accepted.milestones) keys.add(`milestone:${m.name.trim().toLowerCase()}`);
  for (const s of accepted.systemElements) keys.add(`system_element:${s.name.trim().toLowerCase()}`);
  for (const v of accepted.verificationCases) keys.add(`verification_case:${v.name.trim().toLowerCase()}`);
  for (const d of pendingPayloads) {
    try {
      const data = JSON.parse(d.payload) as Record<string, unknown>;
      keys.add(artifactKey(d.artifactType as ArtifactType, data));
    } catch {
      /* skip */
    }
  }
  return keys;
}
