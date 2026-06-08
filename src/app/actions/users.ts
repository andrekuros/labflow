"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSession, hashPassword } from "@/lib/auth";

const COLORS = ["#6366f1", "#0ea5e9", "#ec4899", "#f59e0b", "#10b981", "#a855f7", "#ef4444"];

export async function createUser(input: { name: string; email: string; password: string; role: string; title?: string }) {
  const session = await getSession();
  if (!session || session.role !== "admin") throw new Error("Apenas administradores podem criar usuarios.");

  const email = input.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error("Ja existe um usuario com este email.");

  const count = await prisma.user.count();
  await prisma.user.create({
    data: {
      name: input.name,
      email,
      passwordHash: await hashPassword(input.password),
      role: input.role,
      title: input.title || null,
      avatarColor: COLORS[count % COLORS.length],
    },
  });
  revalidatePath("/team");
}

export async function setUserRole(userId: string, role: string) {
  const session = await getSession();
  if (!session || session.role !== "admin") throw new Error("Apenas administradores.");
  await prisma.user.update({ where: { id: userId }, data: { role } });
  revalidatePath("/team");
}
