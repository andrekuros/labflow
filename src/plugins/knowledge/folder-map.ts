import "server-only";
import { prisma } from "@/lib/db";

export type FolderProjectMap = Record<string, string>;

export function parentFolderFromPath(filePath: string): string {
  const parts = filePath.split("/").filter(Boolean);
  if (parts.length <= 1) return "";
  return parts.slice(0, -1).join("/");
}

export function isExcludedPath(filePath: string, excludeFolders: string[]): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  for (const ex of excludeFolders) {
    const folder = ex.replace(/^\/+|\/+$/g, "");
    if (!folder) continue;
    if (normalized === folder || normalized.startsWith(`${folder}/`)) return true;
  }
  return false;
}

/** Resolve project id from frontmatter and folder→project map (keys or ids). */
export async function resolveProjectId(opts: {
  frontmatterProject?: string;
  frontmatterProjectId?: string;
  filePath: string;
  folderProjectMap: FolderProjectMap;
}): Promise<string | null> {
  if (opts.frontmatterProjectId) {
    const byId = await prisma.project.findUnique({ where: { id: opts.frontmatterProjectId } });
    if (byId) return byId.id;
  }

  const keyOrId = opts.frontmatterProject?.trim();
  if (keyOrId) {
    const byKey = await prisma.project.findUnique({ where: { key: keyOrId.toUpperCase() } });
    if (byKey) return byKey.id;
    const byId = await prisma.project.findUnique({ where: { id: keyOrId } });
    if (byId) return byId.id;
  }

  const parent = parentFolderFromPath(opts.filePath);
  const candidates: string[] = [];
  if (parent) {
    const parts = parent.split("/");
    for (let i = parts.length; i >= 1; i--) {
      candidates.push(parts.slice(0, i).join("/"));
    }
  }

  for (const folder of candidates) {
    const mapped = opts.folderProjectMap[folder]?.trim();
    if (!mapped) continue;
    const byKey = await prisma.project.findUnique({ where: { key: mapped.toUpperCase() } });
    if (byKey) return byKey.id;
    const byId = await prisma.project.findUnique({ where: { id: mapped } });
    if (byId) return byId.id;
  }

  return null;
}
