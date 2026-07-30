import "server-only";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";
import {
  type ProjectFeature,
  type ProjectFeatures,
  type ProjectKind,
  isProjectKind,
  parseProjectFeatures,
  defaultFeaturesForKind,
} from "@/lib/projects/features";

export async function getProjectKindAndFeatures(projectId: string): Promise<{
  kind: ProjectKind;
  features: ProjectFeatures;
} | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { kind: true, featuresJson: true },
  });
  if (!project) return null;
  const kind = isProjectKind(project.kind) ? project.kind : "lab";
  return { kind, features: parseProjectFeatures(project.featuresJson, kind) };
}

export async function projectHasFeature(
  projectId: string,
  feature: ProjectFeature,
): Promise<boolean> {
  const row = await getProjectKindAndFeatures(projectId);
  if (!row) return false;
  return Boolean(row.features[feature]);
}

export async function requireProjectFeature(
  projectId: string,
  feature: ProjectFeature,
): Promise<{ error?: string }> {
  const ok = await projectHasFeature(projectId, feature);
  if (!ok) return { error: `Modulo "${feature}" desabilitado neste projeto.` };
  return {};
}

/** Ensure existing projects get kind/features defaults (idempotent). */
export async function ensureProjectKindDefaults() {
  const projects = await prisma.project.findMany({
    select: { id: true, kind: true, featuresJson: true },
  });
  for (const p of projects) {
    const kind = isProjectKind(p.kind) ? p.kind : "lab";
    let featuresJson = p.featuresJson;
    try {
      const parsed = JSON.parse(featuresJson || "{}") as Record<string, unknown>;
      if (Object.keys(parsed).length === 0) {
        featuresJson = JSON.stringify(defaultFeaturesForKind(kind));
        await prisma.project.update({
          where: { id: p.id },
          data: { kind, featuresJson },
        });
      } else if (!isProjectKind(p.kind)) {
        await prisma.project.update({ where: { id: p.id }, data: { kind: "lab" } });
      }
    } catch {
      await prisma.project.update({
        where: { id: p.id },
        data: { kind, featuresJson: JSON.stringify(defaultFeaturesForKind(kind)) },
      });
    }
  }
}

export type { SessionUser };
