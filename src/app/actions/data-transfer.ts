"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { canManageProject, requireAdmin } from "@/lib/rbac";
import { exportProjectBundle, importProjectBundle } from "@/lib/data-transfer/project-bundle";
import { exportUserBundle, importUserBundle } from "@/lib/data-transfer/user-bundle";
import { PROJECT_BUNDLE_FORMAT_DOC } from "@/lib/data-transfer/format-doc";
import { emit } from "@/lib/events";

export async function exportProjectBundleAction(projectId: string): Promise<string> {
  const session = await getSession();
  if (!session) throw new Error("Nao autenticado");
  if (!(await canManageProject(session, projectId))) throw new Error("Sem permissao");
  const bundle = await exportProjectBundle(projectId);
  return JSON.stringify(bundle, null, 2);
}

/** Guia Markdown do formato do pacote de projeto (para IAs externas). */
export async function getProjectBundleFormatDocAction(): Promise<string> {
  const session = await getSession();
  if (!session) throw new Error("Nao autenticado");
  return PROJECT_BUNDLE_FORMAT_DOC;
}

export async function importProjectBundleAction(
  raw: string,
  keyOverride?: string,
): Promise<{ projectId: string; projectKey: string; summary: string; warnings: string[] }> {
  const session = await requireAdmin();
  const result = await importProjectBundle(raw, { keyOverride: keyOverride?.trim() || undefined });

  await emit({
    type: "project.created",
    actorId: session.id,
    projectId: result.projectId,
    payload: { id: result.projectId, key: result.projectKey, imported: true },
  });

  revalidatePath("/projects");
  revalidatePath(`/projects/${result.projectId}`);

  const parts = Object.entries(result.created)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${n} ${k}`)
    .join(", ");

  return {
    projectId: result.projectId,
    projectKey: result.projectKey,
    summary: parts || "projeto criado",
    warnings: result.warnings,
  };
}

export async function exportUserBundleAction(userId: string): Promise<string> {
  await requireAdmin();
  const bundle = await exportUserBundle(userId);
  return JSON.stringify(bundle, null, 2);
}

export async function importUserBundleAction(
  raw: string,
  mode: "create" | "upsert" = "upsert",
): Promise<{ userId: string; email: string; created: boolean; warnings: string[] }> {
  await requireAdmin();
  const result = await importUserBundle(raw, { mode });
  revalidatePath("/settings");
  revalidatePath("/team");
  revalidatePath(`/team/${result.userId}`);
  return result;
}
