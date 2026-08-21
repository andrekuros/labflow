import "server-only";
import { prisma } from "@/lib/db";
import { getNextcloudSettings } from "@/plugins/knowledge/nextcloud-config";
import {
  ensurePath,
  putFile,
  putFileBytes,
  fileExists,
  type NextcloudConnection,
} from "@/plugins/knowledge/nextcloud-client";
import { parentFolderFromPath } from "@/plugins/knowledge/folder-map";
import { slugifyFileName, LOCAL_VAULT_PREFIX } from "@/lib/knowledge/files";
import {
  vaultProjectRoot,
  vaultWriteFolder,
  vaultGeneratedFolder,
  suggestedSubfolders,
  projectVaultReadme,
} from "@/lib/knowledge/vault-layout";

export async function getVaultConnection(): Promise<NextcloudConnection | null> {
  const cfg = await getNextcloudSettings();
  if (!cfg.enabled || !cfg.url || !cfg.username || !cfg.appPassword) return null;
  return {
    url: cfg.url,
    username: cfg.username,
    password: cfg.appPassword,
    folder: cfg.folder,
  };
}

export function normalizeVaultFolder(folder: string | null | undefined): string {
  if (!folder || folder === "all" || folder === "_local") return LOCAL_VAULT_PREFIX;
  return folder.replace(/^\/+|\/+$/g, "");
}

export async function uniqueVaultPath(folder: string, fileName: string): Promise<string> {
  const dir = folder.replace(/^\/+|\/+$/g, "");
  const extIdx = fileName.lastIndexOf(".");
  const ext = extIdx >= 0 ? fileName.slice(extIdx) : "";
  const base = extIdx >= 0 ? fileName.slice(0, extIdx) : fileName;
  let n = 0;
  while (true) {
    const name = n === 0 ? fileName : `${base}-${n}${ext}`;
    const path = dir ? `${dir}/${name}` : name;
    const existing = await prisma.knowledgeArticle.findUnique({ where: { externalPath: path } });
    if (!existing) return path;
    n += 1;
  }
}

export async function writeVaultMarkdown(
  conn: NextcloudConnection,
  relativePath: string,
  content: string,
): Promise<string | null> {
  const folder = parentFolderFromPath(relativePath);
  if (folder) await ensurePath(conn, folder);
  return putFile(conn, relativePath, content);
}

export async function writeVaultBytes(
  conn: NextcloudConnection,
  relativePath: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<string | null> {
  const folder = parentFolderFromPath(relativePath);
  if (folder) await ensurePath(conn, folder);
  return putFileBytes(conn, relativePath, bytes, contentType);
}

export function generatedDocPath(kind: string, projectKey: string, title: string, ext = ".md"): string {
  const folder = vaultGeneratedFolder(kind, projectKey);
  return `${folder}/${slugifyFileName(title)}${ext}`;
}

export function pageFileName(title: string) {
  return `${slugifyFileName(title)}.md`;
}

export type VaultProjectRef = { key: string; name: string; kind: string };

export async function ensureProjectVault(
  conn: NextcloudConnection,
  project: VaultProjectRef,
): Promise<{ root: string; created: boolean }> {
  const root = vaultProjectRoot(project.kind, project.key);
  await ensurePath(conn, root);
  for (const sub of suggestedSubfolders(project.kind)) {
    await ensurePath(conn, `${root}/${sub}`);
  }
  const readmePath = `${root}/README.md`;
  let created = false;
  if (!(await fileExists(conn, readmePath))) {
    await putFile(conn, readmePath, projectVaultReadme(project));
    created = true;
  }
  return { root, created };
}

export async function ensureProjectVaultFromId(projectId: string): Promise<void> {
  const conn = await getVaultConnection();
  if (!conn) return;
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { key: true, name: true, kind: true },
  });
  if (!project) return;
  await ensureProjectVault(conn, project);
}

/** Destination folder for a new page/file belonging to a project. */
export async function folderForProjectWrite(
  conn: NextcloudConnection | null,
  project: VaultProjectRef,
  preferredFolder?: string | null,
): Promise<string> {
  if (conn) await ensureProjectVault(conn, project);
  const root = vaultProjectRoot(project.kind, project.key);
  const preferred = (preferredFolder ?? "").replace(/^\/+|\/+$/g, "");
  if (preferred && (preferred === root || preferred.startsWith(`${root}/`))) return preferred;
  return vaultWriteFolder(project.kind, project.key);
}
