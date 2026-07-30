"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSession, hashPassword } from "@/lib/auth";
import { emit } from "@/lib/events";
import { indexUser } from "@/lib/ai/knowledge-indexer";
import { notifyAdmins } from "@/lib/notifications";
import { ensurePluginRegistry, getPluginSettings } from "@/plugins/registry";
import { canManageUserProfiles } from "@/lib/user-access";
import {
  legacyRoleToProfiles,
  normalizeProfiles,
  primaryProfile,
  setUserProfiles,
} from "@/lib/user-profiles";
import { parseUsersCsv } from "@/lib/users-csv";

const COLORS = ["#6366f1", "#0ea5e9", "#ec4899", "#f59e0b", "#10b981", "#a855f7", "#ef4444"];

async function requireAdminSession() {
  const session = await getSession();
  if (!session || !canManageUserProfiles(session)) {
    throw new Error("Apenas administradores podem gerenciar usuarios.");
  }
  return session;
}

export async function createUser(input: {
  name: string;
  email: string;
  password: string;
  role: string;
  profiles?: string[];
}) {
  const session = await requireAdminSession();
  const profiles = input.profiles?.length ? normalizeProfiles(input.profiles) : legacyRoleToProfiles(input.role);
  const user = await createUserRecord(
    { ...input, role: primaryProfile(profiles) },
    "active",
    profiles,
  );
  await emit({ type: "user.created", actorId: session.id, targetId: user.id, payload: { id: user.id, name: user.name } });
  revalidatePath("/team");
  revalidatePath("/settings");
  revalidatePath("/academic");
  return user;
}

export async function registerPendingUser(input: { name: string; email: string; password: string }) {
  await ensurePluginRegistry();
  const settings = getPluginSettings("team");
  if (!Boolean(settings.allowSelfRegistration ?? true)) {
    throw new Error("Cadastro publico desabilitado pelo administrador.");
  }

  const defaultRole = String(settings.defaultRole ?? "contributor");
  const profiles = legacyRoleToProfiles(defaultRole);
  const user = await createUserRecord(
    { ...input, role: primaryProfile(profiles) },
    "pending",
    profiles,
  );

  await notifyAdmins({
    kind: "user_pending",
    title: "Novo cadastro aguardando aprovacao",
    message: `${user.name} (${user.email}) solicitou acesso ao LabFlow.`,
    href: "/settings",
  });

  return user;
}

async function createUserRecord(
  input: { name: string; email: string; password: string; role: string },
  accountStatus: "active" | "pending",
  profiles: string[],
) {
  const email = input.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.accountStatus === "pending") {
      throw new Error("Este email ja possui cadastro aguardando aprovacao.");
    }
    throw new Error("Ja existe um usuario com este email.");
  }

  const count = await prisma.user.count();
  const user = await prisma.user.create({
    data: {
      name: input.name.trim(),
      email,
      passwordHash: await hashPassword(input.password),
      role: input.role,
      accountStatus,
      avatarColor: COLORS[count % COLORS.length],
    },
  });

  await setUserProfiles(user.id, profiles);

  if (accountStatus === "active") {
    await indexUser(user.id).catch(() => {});
  }
  return user;
}

export async function approveUser(
  userId: string,
  input?: { role?: string; profiles?: string[]; name?: string; email?: string; password?: string },
) {
  const session = await requireAdminSession();
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.accountStatus !== "pending") throw new Error("Usuario invalido ou ja processado.");

  if (input?.name || input?.email || input?.password) {
    await updateUserProfile(userId, {
      name: input.name,
      email: input.email,
      password: input.password,
    });
  }

  const profiles = input?.profiles?.length
    ? normalizeProfiles(input.profiles)
    : legacyRoleToProfiles(input?.role ?? user.role);
  const role = primaryProfile(profiles);

  await prisma.user.update({
    where: { id: userId },
    data: {
      accountStatus: "active",
      role,
      approvedAt: new Date(),
      approvedBy: session.id,
    },
  });

  await setUserProfiles(userId, profiles);

  await indexUser(userId).catch(() => {});
  await emit({ type: "user.updated", actorId: session.id, targetId: userId, payload: { id: userId } });
  revalidatePath("/team");
  revalidatePath("/settings");
  revalidatePath("/academic");
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
  revalidatePath("/settings");
}

export async function updateUserProfile(
  userId: string,
  input: { role?: string; profiles?: string[]; name?: string; email?: string; password?: string },
) {
  const session = await requireAdminSession();
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("Usuario nao encontrado.");

  const data: { name?: string; email?: string; passwordHash?: string } = {};

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new Error("Nome nao pode ficar vazio.");
    if (name !== user.name) data.name = name;
  }

  if (input.email !== undefined) {
    const email = input.email.trim().toLowerCase();
    if (!email.includes("@")) throw new Error("Email invalido.");
    if (email !== user.email) {
      const taken = await prisma.user.findUnique({ where: { email } });
      if (taken && taken.id !== userId) throw new Error("Este email ja esta em uso.");
      data.email = email;
    }
  }

  if (input.password) {
    if (input.password.length < 6) throw new Error("Senha deve ter pelo menos 6 caracteres.");
    data.passwordHash = await hashPassword(input.password);
  }

  if (input.profiles !== undefined) {
    const normalized = await setUserProfiles(userId, input.profiles);
    await prisma.user.update({ where: { id: userId }, data: { role: primaryProfile(normalized) } });
  } else if (input.role !== undefined) {
    await setUserProfiles(userId, legacyRoleToProfiles(input.role));
  }

  if (Object.keys(data).length > 0) {
    await prisma.user.update({ where: { id: userId }, data });
  }

  await emit({ type: "user.updated", actorId: session.id, targetId: userId, payload: { id: userId } });
  await indexUser(userId).catch(() => {});
  revalidatePath("/team");
  revalidatePath("/settings");
  revalidatePath("/academic");
  revalidatePath(`/team/${userId}`);
}

export type CsvImportResult = {
  created: number;
  skipped: number;
  errors: string[];
};

export async function importUsersFromCsv(csv: string): Promise<CsvImportResult> {
  const session = await requireAdminSession();
  const { rows, errors: parseErrors } = parseUsersCsv(csv);
  const result: CsvImportResult = { created: 0, skipped: 0, errors: [...parseErrors] };

  if (rows.length === 0 && parseErrors.length === 0) {
    throw new Error("CSV vazio ou sem linhas validas");
  }

  for (const row of rows) {
    const exists = await prisma.user.findUnique({ where: { email: row.email } });
    if (exists) {
      result.skipped += 1;
      continue;
    }

    try {
      const profiles = normalizeProfiles(row.profiles);
      const user = await createUserRecord(
        {
          name: row.name,
          email: row.email,
          password: row.password,
          role: primaryProfile(profiles),
        },
        "active",
        profiles,
      );
      await emit({
        type: "user.created",
        actorId: session.id,
        targetId: user.id,
        payload: { id: user.id, name: user.name },
      });
      result.created += 1;
    } catch (e) {
      result.errors.push(`Linha ${row.line}: ${e instanceof Error ? e.message : "erro"}`);
    }
  }

  revalidatePath("/team");
  revalidatePath("/settings");
  return result;
}

export async function setUserRole(userId: string, role: string) {
  return updateUserProfile(userId, { role });
}

export async function deleteUser(userId: string) {
  const session = await requireAdminSession();
  if (session.id === userId) {
    throw new Error("Voce nao pode excluir sua propria conta.");
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    include: { profiles: { select: { profile: true } } },
  });
  if (!target) throw new Error("Usuario nao encontrado.");

  const isTargetAdmin =
    target.profiles.some((p) => p.profile === "admin") || target.role === "admin";

  if (isTargetAdmin && target.accountStatus === "active") {
    const activeAdmins = await prisma.user.count({
      where: {
        accountStatus: "active",
        OR: [{ role: "admin" }, { profiles: { some: { profile: "admin" } } }],
      },
    });
    if (activeAdmins <= 1) {
      throw new Error("Nao e possivel excluir o ultimo administrador ativo.");
    }
  }

  await prisma.user.delete({ where: { id: userId } });
  await emit({ type: "user.updated", actorId: session.id, targetId: userId, payload: { id: userId, deleted: true } });
  revalidatePath("/team");
  revalidatePath("/settings");
}
