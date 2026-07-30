import "server-only";
import nodemailer from "nodemailer";

export type MailAttachment = {
  filename: string;
  content: Buffer;
  contentType?: string;
};

export type SendMailInput = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  attachments?: MailAttachment[];
};

export type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
};

export function getSmtpConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST?.trim();
  if (!host) return null;

  const port = Number(process.env.SMTP_PORT || "587");
  const secure = (process.env.SMTP_SECURE || "").toLowerCase() === "true" || port === 465;
  const user = process.env.SMTP_USER?.trim() ?? "";
  const pass = process.env.SMTP_PASS?.trim() ?? "";
  const from = process.env.SMTP_FROM?.trim() || user || `labflow@${host}`;

  return { host, port, secure, user, pass, from };
}

export function isSmtpConfigured(): boolean {
  return getSmtpConfig() !== null;
}

export async function sendMail(input: SendMailInput): Promise<{ ok: true } | { ok: false; error: string }> {
  const config = getSmtpConfig();
  if (!config) {
    const msg = "SMTP nao configurado (defina SMTP_HOST no .env)";
    console.warn(`[mail] ${msg}`);
    return { ok: false, error: msg };
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.user ? { user: config.user, pass: config.pass } : undefined,
  });

  const to = Array.isArray(input.to) ? input.to.join(", ") : input.to;
  if (!to.trim()) {
    return { ok: false, error: "Nenhum destinatario" };
  }

  try {
    await transporter.sendMail({
      from: config.from,
      to,
      subject: input.subject,
      text: input.text,
      html: input.html,
      attachments: input.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
      })),
    });
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao enviar email";
    console.error("[mail] send failed", err);
    return { ok: false, error: message };
  }
}
