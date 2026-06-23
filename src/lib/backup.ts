import "server-only";
import { readFile, mkdtemp, writeFile, rm } from "fs/promises";
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

export async function createBackupArchive(): Promise<Buffer> {
  const dbPath = resolveDbPath();
  const plugins = await prisma.plugin.findMany({ orderBy: { order: "asc" } });
  const manifest = {
    exportedAt: new Date().toISOString(),
    version: "1",
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
