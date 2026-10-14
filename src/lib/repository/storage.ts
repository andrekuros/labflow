import "server-only";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Local-disk storage for repository bitstreams.
 *
 * The library (KnowledgeArticle) keeps binaries in the Nextcloud vault, which
 * makes it unusable when Nextcloud is not configured. The repository owns its
 * bytes instead, so a fresh self-hosted install works with no external service;
 * mirroring a record into the vault stays an optional, separate step.
 */

export const REPOSITORY_STORAGE_ROOT =
  process.env.REPOSITORY_STORAGE_DIR && process.env.REPOSITORY_STORAGE_DIR.trim()
    ? path.resolve(process.env.REPOSITORY_STORAGE_DIR.trim())
    : path.resolve(process.cwd(), "storage", "repository");

/** 64 MB default ceiling per file. */
export const DEFAULT_MAX_FILE_BYTES = 64 * 1024 * 1024;

export const REPOSITORY_ACCEPTED_EXTENSIONS = [
  "pdf", "md", "txt", "docx", "doc", "xlsx", "xls", "pptx", "ppt",
  "csv", "json", "xml", "bib", "ris", "zip", "png", "jpg", "jpeg", "svg", "tif", "tiff",
] as const;

const EXT_RE = new RegExp(`\\.(${REPOSITORY_ACCEPTED_EXTENSIONS.join("|")})$`, "i");

export function isAcceptedRepositoryFile(name: string): boolean {
  return EXT_RE.test(name);
}

export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "arquivo";
  return base.replace(/[^\w.\- ()\[\]]/g, "_").replace(/\s+/g, " ").trim().slice(0, 180) || "arquivo";
}

export function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** `<year>/<recordId>/<fileId>__<name>` — stable, readable, easy to back up. */
export function buildStoragePath(opts: {
  recordId: string;
  fileId: string;
  fileName: string;
  year?: number;
}): string {
  const year = opts.year ?? new Date().getUTCFullYear();
  return `${year}/${opts.recordId}/${opts.fileId}__${sanitizeFileName(opts.fileName)}`;
}

/**
 * Resolve a stored relative path to an absolute one, refusing anything that
 * escapes the storage root. Paths come from the database, but a corrupted or
 * hand-edited row must not be able to read `/etc/passwd`.
 */
export function resolveStoragePath(relativePath: string): string {
  const abs = path.resolve(REPOSITORY_STORAGE_ROOT, relativePath);
  const root = REPOSITORY_STORAGE_ROOT.endsWith(path.sep)
    ? REPOSITORY_STORAGE_ROOT
    : REPOSITORY_STORAGE_ROOT + path.sep;
  if (abs !== REPOSITORY_STORAGE_ROOT && !abs.startsWith(root)) {
    throw new Error("Caminho de arquivo invalido");
  }
  return abs;
}

export async function saveRepositoryFile(opts: {
  storagePath: string;
  bytes: Uint8Array;
}): Promise<{ checksum: string; byteSize: number }> {
  const abs = resolveStoragePath(opts.storagePath);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, opts.bytes);
  return { checksum: sha256(opts.bytes), byteSize: opts.bytes.byteLength };
}

export async function readRepositoryFile(storagePath: string): Promise<Buffer> {
  return readFile(resolveStoragePath(storagePath));
}

export async function repositoryFileExists(storagePath: string): Promise<boolean> {
  try {
    const s = await stat(resolveStoragePath(storagePath));
    return s.isFile();
  } catch {
    return false;
  }
}

export async function deleteRepositoryFile(storagePath: string): Promise<void> {
  await rm(resolveStoragePath(storagePath), { force: true });
}

/** Remove everything stored for a record (used when the record is deleted). */
export async function deleteRecordStorage(storagePaths: string[]): Promise<void> {
  const dirs = new Set<string>();
  for (const p of storagePaths) {
    await deleteRepositoryFile(p);
    dirs.add(path.dirname(resolveStoragePath(p)));
  }
  for (const dir of dirs) {
    await rm(dir, { recursive: true, force: true });
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
