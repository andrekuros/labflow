/** Path helpers for knowledge folders (safe for client + server). */

export function isPathUnderFolders(filePath: string, folders: string[]): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  for (const ex of folders) {
    const folder = ex.replace(/^\/+|\/+$/g, "");
    if (!folder) continue;
    if (normalized === folder || normalized.startsWith(`${folder}/`)) return true;
  }
  return false;
}

export function articleIsAdminOnly(
  article: { externalPath?: string | null; externalFolder?: string | null },
  adminFolders: string[],
): boolean {
  if (adminFolders.length === 0) return false;
  const paths = [article.externalPath, article.externalFolder].filter(Boolean) as string[];
  return paths.some((p) => isPathUnderFolders(p, adminFolders));
}
