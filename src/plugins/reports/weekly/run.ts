import "server-only";
import { prisma } from "@/lib/db";
import { emit } from "@/lib/events";
import { sendMail, isSmtpConfigured } from "@/lib/mail";
import { normalizeAiSections, type AiAnalysisSection } from "@/plugins/reports/ai-sections";
import { generateWeeklyNarrative } from "@/plugins/reports/weekly/agent";
import {
  collectWeeklyLabReportData,
  defaultWeeklyPeriod,
} from "@/plugins/reports/weekly/data";
import { generateWeeklyReportMarkdown } from "@/plugins/reports/weekly/markdown";
import { generateWeeklyReportPdf } from "@/plugins/reports/weekly/pdf";
import { formatDate } from "@/lib/utils";
import { ensurePluginRegistry, getPlugin, getPluginSettings } from "@/plugins/registry";

export type WeeklyReportFormat = "pdf" | "markdown" | "both";

export type WeeklyReportRunResult = {
  ok: boolean;
  error?: string;
  filename?: string;
  pdfBase64?: string;
  markdown?: string;
  markdownFilename?: string;
  recipients?: string[];
  emailed?: boolean;
  aiUsed?: boolean;
  period?: { from: string; to: string };
};

async function listAdminEmails(): Promise<string[]> {
  const admins = await prisma.user.findMany({
    where: { role: "admin", accountStatus: "active" },
    select: { email: true },
  });
  return admins.map((a) => a.email).filter(Boolean);
}

export async function runWeeklyLabReport(options?: {
  actorId?: string | null;
  sendEmail?: boolean;
  includePdfBase64?: boolean;
  includeMarkdown?: boolean;
  format?: WeeklyReportFormat;
  from?: Date;
  to?: Date;
  aiSections?: AiAnalysisSection[];
}): Promise<WeeklyReportRunResult> {
  const sendEmail = options?.sendEmail === true;
  const format = options?.format ?? (sendEmail ? "both" : "both");
  const wantPdf = format === "pdf" || format === "both" || sendEmail;
  const wantMarkdown = format === "markdown" || format === "both" || options?.includeMarkdown === true;
  const period = options?.from && options?.to
    ? { from: options.from, to: options.to }
    : defaultWeeklyPeriod();
  const { from, to } = period;
  const aiSections = normalizeAiSections(options?.aiSections);

  try {
    const data = await collectWeeklyLabReportData(from, to);
    const narrative = await generateWeeklyNarrative(
      data,
      aiSections.length
        ? aiSections
        : [
            "executiveSummary",
            "highlights",
            "pendenciesAndRisks",
            "workflowImprovements",
            "otherSuggestions",
          ],
    );

    const dateKey = from.toISOString().slice(0, 10);
    const pdfFilename = `labflow-relatorio-lab-${dateKey}.pdf`;
    const mdFilename = `labflow-relatorio-lab-${dateKey}.md`;

    const pdf = wantPdf ? await generateWeeklyReportPdf(data, narrative) : null;
    const markdown = wantMarkdown ? generateWeeklyReportMarkdown(data, narrative) : undefined;

    const recipients = await listAdminEmails();
    let emailed = false;
    let mailError: string | undefined;

    if (sendEmail) {
      if (!isSmtpConfigured()) {
        mailError = "SMTP nao configurado";
      } else if (recipients.length === 0) {
        mailError = "Nenhum admin ativo com email";
      } else if (!pdf) {
        mailError = "PDF necessario para envio por email";
      } else {
        const attachments = [
          { filename: pdfFilename, content: pdf, contentType: "application/pdf" },
        ];
        if (markdown) {
          attachments.push({
            filename: mdFilename,
            content: Buffer.from(markdown, "utf8"),
            contentType: "text/markdown; charset=utf-8",
          });
        }
        const mail = await sendMail({
          to: recipients,
          subject: `LabFlow — Relatorio (${formatDate(from)} a ${formatDate(to)})`,
          text: [
            "Segue em anexo o relatorio do laboratorio.",
            "",
            narrative.executiveSummary ?? "",
            "",
            `Periodo: ${formatDate(from)} a ${formatDate(to)}`,
          ].join("\n"),
          attachments,
        });
        if (mail.ok) emailed = true;
        else mailError = mail.error;
      }
    }

    await emit({
      type: "report.weekly_sent",
      actorId: options?.actorId ?? null,
      payload: {
        from: from.toISOString(),
        to: to.toISOString(),
        recipients,
        emailed,
        aiUsed: narrative.aiUsed,
        format,
        sendEmail,
        mailError: mailError ?? null,
      },
    });

    return {
      ok: true,
      error: sendEmail && !emailed ? mailError : undefined,
      filename: pdf ? pdfFilename : undefined,
      pdfBase64: pdf && options?.includePdfBase64 !== false ? pdf.toString("base64") : undefined,
      markdown,
      markdownFilename: markdown ? mdFilename : undefined,
      recipients,
      emailed,
      aiUsed: narrative.aiUsed,
      period: { from: from.toISOString(), to: to.toISOString() },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao gerar relatorio";
    console.error("[weekly-report]", err);
    return { ok: false, error: message };
  }
}

export async function isWeeklyEmailEnabled(): Promise<boolean> {
  await ensurePluginRegistry();
  const plugin = getPlugin("reports");
  if (!plugin?.enabled) return false;
  return Boolean(plugin.settings.weeklyEmailEnabled ?? false);
}

export function weeklyEmailSchedule(): { day: number; hour: number } {
  const settings = getPluginSettings("reports");
  const day = Number(settings.weeklyEmailDay ?? 1);
  const hour = Number(settings.weeklyEmailHour ?? 8);
  return {
    day: Number.isFinite(day) ? Math.min(6, Math.max(0, Math.trunc(day))) : 1,
    hour: Number.isFinite(hour) ? Math.min(23, Math.max(0, Math.trunc(hour))) : 8,
  };
}
