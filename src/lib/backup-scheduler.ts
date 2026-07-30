import "server-only";
import {
  isBackupSchedulerEnabled,
  saveBackupToDisk,
  scheduledBackupHour,
  resolveBackupDir,
} from "@/lib/backup";

const g = globalThis as { __labflowBackupScheduler?: boolean };

function msUntilNextLocalTime(hour: number, minute = 0): number {
  const now = new Date();
  const next = new Date(now);
  next.setHours(hour, minute, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }
  return next.getTime() - now.getTime();
}

export async function runScheduledBackup(): Promise<string> {
  const filePath = await saveBackupToDisk();
  console.log(`[backup] automatico salvo em ${filePath}`);
  return filePath;
}

function scheduleNextRun() {
  const hour = scheduledBackupHour();
  const delay = msUntilNextLocalTime(hour, 0);
  const nextAt = new Date(Date.now() + delay);

  setTimeout(() => {
    runScheduledBackup().catch((err) => console.error("[backup] automatico falhou", err));
    scheduleNextRun();
  }, delay);

  console.log(
    `[backup] proximo backup automatico as ${String(hour).padStart(2, "0")}:00 (${nextAt.toLocaleString("pt-BR")}) em ${resolveBackupDir()}`,
  );
}

/** Daily backup at BACKUP_HOUR (default 1:00 local time) for long-running deployments. */
export function startBackupScheduler() {
  if (g.__labflowBackupScheduler) return;
  if (typeof setTimeout === "undefined") return;
  if (!isBackupSchedulerEnabled()) {
    console.log("[backup] agendamento automatico desabilitado (BACKUP_ENABLED=false)");
    return;
  }

  g.__labflowBackupScheduler = true;
  scheduleNextRun();
}
