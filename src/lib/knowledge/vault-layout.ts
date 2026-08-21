import { type ProjectKind, isProjectKind, PROJECT_KIND_LABELS } from "@/lib/projects/features";
import { slugifyFileName } from "@/lib/knowledge/files";

export type VaultAttachTarget = "task" | "deliverable" | "requirement" | "project" | "verification";

const ATTACH_SEGMENTS: Record<Exclude<VaultAttachTarget, "project">, string> = {
  task: "tarefas",
  deliverable: "entregaveis",
  requirement: "requisitos",
  verification: "verificacao",
};

const ACADEMIC_SEGMENTS = ["teses", "dissertacoes", "papers"] as const;

export function vaultKey(key: string): string {
  return key.toLowerCase();
}

export function vaultProjectRoot(kind: string, key: string): string {
  const k = vaultKey(key);
  const pk: ProjectKind = isProjectKind(kind) ? kind : "lab";
  switch (pk) {
    case "admin":
      return `admin/${k}`;
    case "thesis":
      return `academic/teses/${k}`;
    case "dissertation":
      return `academic/dissertacoes/${k}`;
    case "paper":
      return `academic/papers/${k}`;
    default:
      return `lab/${k}`;
  }
}

export function suggestedSubfolders(kind: string): string[] {
  const pk: ProjectKind = isProjectKind(kind) ? kind : "lab";
  switch (pk) {
    case "admin":
      return ["gerado", "anexos"];
    case "thesis":
    case "dissertation":
      return ["metodologia", "manuscrito", "gerado", "anexos"];
    case "paper":
      return ["rascunhos", "submissao", "gerado", "anexos"];
    default:
      return ["notas", "protocolos", "gerado", "anexos"];
  }
}

export function defaultWriteSubfolder(kind: string): string {
  const pk: ProjectKind = isProjectKind(kind) ? kind : "lab";
  switch (pk) {
    case "admin":
      return "";
    case "thesis":
    case "dissertation":
      return "manuscrito";
    case "paper":
      return "rascunhos";
    default:
      return "notas";
  }
}

export function vaultWriteFolder(kind: string, key: string): string {
  const root = vaultProjectRoot(kind, key);
  const sub = defaultWriteSubfolder(kind);
  return sub ? `${root}/${sub}` : root;
}

export function vaultGeneratedFolder(kind: string, key: string): string {
  return `${vaultProjectRoot(kind, key)}/gerado`;
}

export function attachmentEntitySlug(title: string, id: string): string {
  return `${slugifyFileName(title).slice(0, 48)}-${id.slice(-6)}`;
}

/** Destination folder for a file attached to a work item. Project-level files go in `anexos/`. */
export function vaultAttachmentFolder(
  kind: string,
  key: string,
  targetType: VaultAttachTarget,
  slug?: string,
): string {
  const base = `${vaultProjectRoot(kind, key)}/anexos`;
  if (targetType === "project") return base;
  const segment = ATTACH_SEGMENTS[targetType];
  return slug ? `${base}/${segment}/${slug}` : `${base}/${segment}`;
}

function folderParts(filePath: string): string[] {
  const parts = filePath.split("/").filter(Boolean);
  if (parts.length && /\.[a-z0-9]+$/i.test(parts[parts.length - 1] ?? "")) {
    parts.pop();
  }
  return parts;
}

/** Infer project key (uppercase) from a vault path. Supports the new convention and legacy `projetos/{key}`. */
export function projectKeyFromVaultPath(filePath: string): string | null {
  const parts = folderParts(filePath);
  if (parts.length < 2) return null;
  if (parts[0] === "lab" || parts[0] === "admin" || parts[0] === "projetos") {
    return parts[1] ? parts[1].toUpperCase() : null;
  }
  if (parts[0] === "academic" && parts.length >= 3) {
    if ((ACADEMIC_SEGMENTS as readonly string[]).includes(parts[1])) {
      return parts[2] ? parts[2].toUpperCase() : null;
    }
  }
  return null;
}

export function looksLikeProjectVaultFolder(folder: string): boolean {
  return projectKeyFromVaultPath(`${folder.replace(/^\/+|\/+$/g, "")}/doc.md`) != null;
}

export function projectVaultReadme(project: { key: string; name: string; kind: string }): string {
  const sub = suggestedSubfolders(project.kind);
  const label = isProjectKind(project.kind) ? PROJECT_KIND_LABELS[project.kind] : project.kind;
  return `---
title: ${project.name}
status: active
project: ${project.key}
tags: vault,indice
---

# ${project.name} (${project.key})

Pasta automatica do vault LabFlow — ${label}.

Subpastas sugeridas:

${sub.map((s) => `- \`${s}/\``).join("\n")}
`;
}
