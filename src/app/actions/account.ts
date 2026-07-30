"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSession, hashPassword, verifyPassword, buildSessionUser, createSession } from "@/lib/auth";
import { indexUser } from "@/lib/ai/knowledge-indexer";

export type AccountUpdateResult = { ok: true } | { ok: false; error: string };

export async function updateMyAccountAction(input: {
  name?: string;
  email?: string;
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
}): Promise<AccountUpdateResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Nao autenticado." };

  const user = await prisma.user.findUnique({ where: { id: session.id } });
  if (!user || user.accountStatus !== "active") {
    return { ok: false, error: "Conta indisponivel." };
  }

  const name = input.name?.trim();
  const email = input.email?.trim().toLowerCase();
  const currentPassword = input.currentPassword ?? "";
  const newPassword = input.newPassword ?? "";
  const confirmPassword = input.confirmPassword ?? "";

  const wantsEmailChange = email !== undefined && email !== user.email;
  const wantsPasswordChange = Boolean(newPassword || confirmPassword);

  if (wantsEmailChange || wantsPasswordChange) {
    if (!currentPassword) {
      return { ok: false, error: "Informe a senha atual para alterar email ou senha." };
    }
    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) return { ok: false, error: "Senha atual incorreta." };
  }

  if (name !== undefined && !name) {
    return { ok: false, error: "Nome nao pode ficar vazio." };
  }

  if (wantsEmailChange) {
    if (!email?.includes("@")) return { ok: false, error: "Email invalido." };
    const taken = await prisma.user.findUnique({ where: { email } });
    if (taken && taken.id !== user.id) {
      return { ok: false, error: "Este email ja esta em uso." };
    }
  }

  if (wantsPasswordChange) {
    if (newPassword.length < 6) {
      return { ok: false, error: "Nova senha deve ter pelo menos 6 caracteres." };
    }
    if (newPassword !== confirmPassword) {
      return { ok: false, error: "Nova senha e confirmacao nao conferem." };
    }
  }

  const data: { name?: string; email?: string; passwordHash?: string } = {};
  if (name !== undefined && name !== user.name) data.name = name;
  if (wantsEmailChange && email) data.email = email;
  if (wantsPasswordChange) data.passwordHash = await hashPassword(newPassword);

  if (Object.keys(data).length === 0) {
    return { ok: true };
  }

  await prisma.user.update({ where: { id: user.id }, data });
  await createSession(await buildSessionUser({ ...user, ...data, email: data.email ?? user.email, name: data.name ?? user.name }));
  await indexUser(user.id).catch(() => {});

  revalidatePath("/settings");
  revalidatePath("/team");
  revalidatePath(`/team/${user.id}`);
  revalidatePath("/", "layout");

  return { ok: true };
}
