"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSession, hashPassword } from "@/lib/auth";
import { emit } from "@/lib/events";
import { indexUser } from "@/lib/ai/knowledge-indexer";
import { notifyAdmins } from "@/lib/notifications";
import { ensurePluginRegistry, getPluginSettings } from "@/plugins/registry";
import { canManageUserProfiles } from "@/lib/user-access";

const COLORS = ["#6366f1", "#0ea5e9", "#ec4899", "#f59e0b", "#10b981", "#a855f7", "#ef4444"];
const VALID_ROLES = new Set(["admin", "researcher", "project_manager", "contributor", "viewer"]);

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

async function requireAdminSession() {
  const session = await getSession();
  if (!session || !canManageUserProfiles(session.role)) {
    throw new Error("Apenas administradores podem gerenciar usuarios.");
  }
  return session;
}

export async function createUser(input: { name: string; email: string; password: string; role: string; title?: string }) {
  const session = await requireAdminSession();
  const user = await createUserRecord(input, "active");
  await emit({ type: "user.created", actorId: session.id, payload: { id: user.id, name: user.name } });
  revalidatePath("/team");
  return user;
}

export async function registerPendingUser(input: { name: string; email: string; password: string; title?: string }) {
  await ensurePluginRegistry();
  const settings = getPluginSettings("team");
  if (!Boolean(settings.allowSelfRegistration ?? true)) {
    throw new Error("Cadastro publico desabilitado pelo administrador.");
  }

  const defaultRole = String(settings.defaultRole ?? "contributor");
  const user = await createUserRecord(
    { ...input, role: defaultRole },
    "pending",
  );

  await notifyAdmins({
    kind: "user_pending",
    title: "Novo cadastro aguardando aprovacao",
    message: `${user.name} (${user.email}) solicitou acesso ao LabFlow.`,
    href: "/team",
  });

  return user;
}

async function createUserRecord(
  input: { name: string; email: string; password: string; role: string; title?: string },
  accountStatus: "active" | "pending",
) {
  const email = input.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.accountStatus === "pending") {
      throw new Error("Este email ja possui cadastro aguardando aprovacao.");
    }
    throw new Error("Ja existe um usuario com este email.");
  }

  const role = VALID_ROLES.has(input.role) ? input.role : "contributor";
  const count = await prisma.user.count();
  const user = await prisma.user.create({
    data: {
      name: input.name.trim(),
      email,
      passwordHash: await hashPassword(input.password),
      role: accountStatus === "pending" ? role : role,
      title: input.title?.trim() || null,
      accountStatus,
      avatarColor: COLORS[count % COLORS.length],
    },
  });
  if (accountStatus === "active") {
    await indexUser(user.id).catch(() => {});
  }
  return user;
}

export async function approveUser(userId: string, input?: { role?: string; title?: string }) {
  const session = await requireAdminSession();
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.accountStatus !== "pending") throw new Error("Usuario invalido ou ja processado.");

  const role = input?.role && VALID_ROLES.has(input.role) ? input.role : user.role;

  await prisma.user.update({
    where: { id: userId },
    data: {
      accountStatus: "active",
      role,
      title: input?.title !== undefined ? input.title || null : user.title,
      approvedAt: new Date(),
      approvedBy: session.id,
    },
  });

  await indexUser(userId).catch(() => {});
  await emit({ type: "user.updated", actorId: session.id, payload: { id: userId } });
  revalidatePath("/team");
}

export async function rejectUser(userId: string) {
  const session = await requireAdminSession();
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.accountStatus !== "pending") throw new Error("Usuario invalido ou ja processado.");

  await prisma.user.update({
    where: { id: userId },
    data: { accountStatus: "rejected", approvedAt: null, approvedBy: session.id },
  });

  revalidatePath("/team");
}

export async function updateUserProfile(
  userId: string,
  input: { role?: string; title?: string | null },
) {
  const session = await requireAdminSession();
  const data: { role?: string; title?: string | null } = {};
  if (input.role !== undefined) {
    if (!VALID_ROLES.has(input.role)) throw new Error("Papel invalido.");
    data.role = input.role;
  }
  if (input.title !== undefined) data.title = input.title || null;

  await prisma.user.update({ where: { id: userId }, data });
  await emit({ type: "user.updated", actorId: session.id, payload: { id: userId } });
  await indexUser(userId).catch(() => {});
  revalidatePath("/team");
  revalidatePath(`/team/${userId}`);
}

export type CsvImportResult = {
  created: number;
  skipped: number;
  errors: string[];
};

export async function importUsersFromCsv(csv: string): Promise<CsvImportResult> {
  const session = await requireAdminSession();

  const lines = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));

  if (lines.length === 0) throw new Error("CSV vazio");

  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const hasHeader = header.includes("email") && header.includes("name");
  const dataLines = hasHeader ? lines.slice(1) : lines;

  const col = (name: string) => (hasHeader ? header.indexOf(name) : -1);
  const idx = {
    name: hasHeader ? col("name") : 0,
    email: hasHeader ? col("email") : 1,
    password: hasHeader ? col("password") : 2,
    role: hasHeader ? col("role") : 3,
    title: hasHeader ? col("title") : 4,
  };

  const result: CsvImportResult = { created: 0, skipped: 0, errors: [] };

  for (const [i, line] of dataLines.entries()) {
    const cols = parseCsvLine(line);
    const name = cols[idx.name]?.trim();
    const email = cols[idx.email]?.trim().toLowerCase();
    const password = cols[idx.password]?.trim();
    const role = cols[idx.role]?.trim() || "researcher";
    const title = idx.title >= 0 ? cols[idx.title]?.trim() : "";

    if (!name || !email || !password) {
      result.errors.push(`Linha ${i + (hasHeader ? 2 : 1)}: name, email e password obrigatorios`);
      continue;
    }

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      result.skipped += 1;
      continue;
    }

    try {
      const user = await createUserRecord({ name, email, password, role, title: title || undefined }, "active");
      await emit({ type: "user.created", actorId: session.id, payload: { id: user.id, name: user.name } });
      result.created += 1;
    } catch (e) {
      result.errors.push(`Linha ${i + (hasHeader ? 2 : 1)}: ${e instanceof Error ? e.message : "erro"}`);
    }
  }

  revalidatePath("/team");
  return result;
}

export async function setUserRole(userId: string, role: string) {
  return updateUserProfile(userId, { role });
}
