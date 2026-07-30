import "server-only";
import { readFile, mkdtemp, writeFile, rm, mkdir, readdir, stat, unlink } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { prisma } from "@/lib/db";

const exec = promisify(execFile);

function resolveDbPath(): string {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  const file = url.replace(/^file:/, "");
  if (path.isAbsolute(file)) return file;
  return path.join(process.cwd(), "prisma", file.replace(/^\.\//, ""));
}

export function resolveBackupDir(): string {
  const configured = process.env.BACKUP_DIR?.trim();
  if (configured) {
    return path.isAbsolute(configured) ? configured : path.join(process.cwd(), configured);
  }
  return path.join(process.cwd(), "backups");
}

export function backupRetentionDays(): number {
  return Math.max(1, Number(process.env.BACKUP_RETENTION_DAYS ?? 30) || 30);
}

export function isBackupSchedulerEnabled(): boolean {
  const raw = process.env.BACKUP_ENABLED?.trim().toLowerCase();
  if (raw === "false" || raw === "0" || raw === "no") return false;
  return true;
}

export function scheduledBackupHour(): number {
  const hour = Number(process.env.BACKUP_HOUR ?? 1);
  if (!Number.isFinite(hour)) return 1;
  return Math.min(23, Math.max(0, Math.floor(hour)));
}

/** Row counts included in backup manifest for verification. */
export async function getBackupDataStats() {
  const [
    users,
    projects,
    tasks,
    knowledgeArticles,
    embeddings,
    publications,
    activityLogs,
    feedbacks,
    permissions,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.project.count(),
    prisma.task.count(),
    prisma.knowledgeArticle.count(),
    prisma.embedding.count(),
    prisma.project.count({ where: { kind: "paper" } }),
    prisma.activityLog.count(),
    prisma.feedback.count(),
    prisma.permission.count(),
  ]);

  return {
    users,
    projects,
    tasks,
    knowledgeArticles,
    embeddings,
    publications,
    activityLogs,
    feedbacks,
    permissions,
  };
}

export async function createBackupArchive(): Promise<Buffer> {
  const dbPath = resolveDbPath();
  const [plugins, stats] = await Promise.all([
    prisma.plugin.findMany({ orderBy: { order: "asc" } }),
    getBackupDataStats(),
  ]);
  const manifest = {
    exportedAt: new Date().toISOString(),
    version: "1",
    database: "sqlite",
    includes: [
      "Todos os dados da plataforma (usuarios, projetos, tarefas, conhecimento, forum, publicacoes, RBAC, etc.)",
      "Embeddings RAG (podem ser reindexados no destino)",
      "Configuracoes dos plugins",
    ],
    excludes: [
      "Variaveis de ambiente (.env) — JWT_SECRET, chaves de API, etc.",
      "Arquivos externos (Nextcloud) — apenas metadados e conteudo sincronizado no banco",
    ],
    stats,
    plugins: plugins.map((p) => ({
      pluginId: p.pluginId,
      name: p.name,
      version: p.version,
      enabled: p.enabled,
      config: JSON.parse(p.config || "{}"),
    })),
  };

  const tmpDir = await mkdtemp(path.join(tmpdir(), "labflow-backup-"));
  const archivePath = path.join(tmpdir(), `labflow-backup-${Date.now()}.tar.gz`);

  try {
    await writeFile(path.join(tmpDir, "manifest.json"), JSON.stringify(manifest, null, 2));
    const db = await readFile(dbPath);
    await writeFile(path.join(tmpDir, "labflow.db"), db);
    await exec("tar", ["-czf", archivePath, "-C", tmpDir, "."]);
    return await readFile(archivePath);
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    await rm(archivePath, { force: true }).catch(() => {});
  }
}

function backupFilename(date = new Date()): string {
  const stamp = date.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `labflow-backup-${stamp}.tar.gz`;
}

export async function pruneOldBackups(dir = resolveBackupDir()): Promise<number> {
  const cutoff = Date.now() - backupRetentionDays() * 86_400_000;
  let removed = 0;

  let entries: string[] = [];
  try {
    entries = await readdir(dir);
  } catch {
    return 0;
  }

  await Promise.all(
    entries
      .filter((name) => name.startsWith("labflow-backup-") && name.endsWith(".tar.gz"))
      .map(async (name) => {
        const filePath = path.join(dir, name);
        try {
          const info = await stat(filePath);
          if (info.mtimeMs < cutoff) {
            await unlink(filePath);
            removed += 1;
          }
        } catch {
          // ignore missing or locked files
        }
      }),
  );

  return removed;
}

/** Creates a backup archive and saves it to BACKUP_DIR (default: ./backups). */
export async function saveBackupToDisk(): Promise<string> {
  const archive = await createBackupArchive();
  const dir = resolveBackupDir();
  await mkdir(dir, { recursive: true });
  const filePath = path.join(dir, backupFilename());
  await writeFile(filePath, archive);
  const removed = await pruneOldBackups(dir);
  if (removed > 0) {
    console.log(`[backup] removed ${removed} arquivo(s) antigo(s)`);
  }
  return filePath;
}
