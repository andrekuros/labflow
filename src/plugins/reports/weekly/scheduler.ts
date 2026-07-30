import "server-only";
import {
  isWeeklyEmailEnabled,
  runWeeklyLabReport,
  weeklyEmailSchedule,
} from "@/plugins/reports/weekly/run";
import { ensurePluginRegistry } from "@/plugins/registry";

const g = globalThis as {
  __labflowWeeklyReportScheduler?: boolean;
  __labflowWeeklyReportLastKey?: string;
};

function msUntilNextWeeklySlot(day: number, hour: number): number {
  const now = new Date();
  const next = new Date(now);
  next.setSeconds(0, 0);
  next.setMinutes(0);
  next.setHours(hour);

  const deltaDay = (day - now.getDay() + 7) % 7;
  next.setDate(now.getDate() + deltaDay);

  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 7);
  }
  return next.getTime() - now.getTime();
}

function runKey(day: number, hour: number, at = new Date()): string {
  return `${at.toISOString().slice(0, 10)}-${day}-${hour}`;
}

export async function runScheduledWeeklyReport(): Promise<void> {
  await ensurePluginRegistry();
  if (!(await isWeeklyEmailEnabled())) {
    console.log("[weekly-report] agendamento ativo, mas weeklyEmailEnabled=false — pulando envio");
    return;
  }

  const { day, hour } = weeklyEmailSchedule();
  const key = runKey(day, hour);
  if (g.__labflowWeeklyReportLastKey === key) {
    return;
  }
  g.__labflowWeeklyReportLastKey = key;

  const result = await runWeeklyLabReport({ sendEmail: true, format: "both" });
  if (result.ok && result.emailed) {
    console.log(
      `[weekly-report] enviado para ${(result.recipients ?? []).join(", ") || "(sem destinatarios)"}`,
    );
  } else if (result.ok) {
    console.error(`[weekly-report] PDF gerado mas email nao enviado: ${result.error}`);
  } else {
    console.error(`[weekly-report] falhou: ${result.error}`);
  }
}

function scheduleNextRun() {
  const { day, hour } = weeklyEmailSchedule();
  const delay = msUntilNextWeeklySlot(day, hour);
  const nextAt = new Date(Date.now() + delay);

  setTimeout(() => {
    void (async () => {
      try {
        await ensurePluginRegistry();
        await runScheduledWeeklyReport();
      } catch (err) {
        console.error("[weekly-report] agendamento falhou", err);
      } finally {
        scheduleNextRun();
      }
    })();
  }, delay);

  console.log(
    `[weekly-report] proximo envio: dia=${day} hora=${String(hour).padStart(2, "0")}:00 (${nextAt.toLocaleString("pt-BR")})`,
  );
}

/** Weekly lab report email for long-running deployments. */
export function startWeeklyReportScheduler() {
  if (g.__labflowWeeklyReportScheduler) return;
  if (typeof setTimeout === "undefined") return;

  g.__labflowWeeklyReportScheduler = true;

  void ensurePluginRegistry().then(() => {
    scheduleNextRun();
  });
}
