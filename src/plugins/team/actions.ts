"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSession, hashPassword } from "@/lib/auth";
import { emit } from "@/lib/events";
import { indexUser } from "@/lib/ai/knowledge-indexer";

const COLORS = ["#6366f1", "#0ea5e9", "#ec4899", "#f59e0b", "#10b981", "#a855f7", "#ef4444"];
const VALID_ROLES = new Set(["admin", "researcher", "phd", "msc", "student"]);

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

export async function createUser(input: { name: string; email: string; password: string; role: string; title?: string }) {
  const session = await getSession();
  if (!session || session.role !== "admin") throw new Error("Apenas administradores podem criar usuarios.");

  const user = await createUserRecord(input);
  await emit({ type: "user.created", actorId: session.id, payload: { id: user.id, name: user.name } });
  revalidatePath("/team");
  return user;
}

async function createUserRecord(input: { name: string; email: string; password: string; role: string; title?: string }) {
  const email = input.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error("Ja existe um usuario com este email.");

  const role = VALID_ROLES.has(input.role) ? input.role : "researcher";
  const count = await prisma.user.count();
  const user = await prisma.user.create({
    data: {
      name: input.name.trim(),
      email,
      passwordHash: await hashPassword(input.password),
      role,
      title: input.title?.trim() || null,
      avatarColor: COLORS[count % COLORS.length],
    },
  });
  await indexUser(user.id).catch(() => {});
  return user;
}

export type CsvImportResult = {
  created: number;
  skipped: number;
  errors: string[];
};

export async function importUsersFromCsv(csv: string): Promise<CsvImportResult> {
  const session = await getSession();
  if (!session || session.role !== "admin") throw new Error("Apenas administradores.");

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
      const user = await createUserRecord({ name, email, password, role, title: title || undefined });
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
  const session = await getSession();
  if (!session || session.role !== "admin") throw new Error("Apenas administradores.");
  await prisma.user.update({ where: { id: userId }, data: { role } });
  await emit({ type: "user.updated", actorId: session.id, payload: { id: userId } });
  revalidatePath("/team");
}
