"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import {
  listNotifications,
  unreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/lib/notifications";

export async function getNotificationsAction() {
  const session = await getSession();
  if (!session) throw new Error("Nao autenticado");
  const rows = await listNotifications(session.id);
  return rows.map((n) => ({
    id: n.id,
    kind: n.kind,
    title: n.title,
    message: n.message,
    href: n.href,
    read: n.read,
    createdAt: n.createdAt.toISOString(),
  }));
}

export async function getUnreadNotificationCountAction() {
  const session = await getSession();
  if (!session) return 0;
  return unreadCount(session.id);
}

export async function markNotificationReadAction(id: string) {
  const session = await getSession();
  if (!session) throw new Error("Nao autenticado");
  await markNotificationRead(id, session.id);
  revalidatePath("/", "layout");
}

export async function markAllNotificationsReadAction() {
  const session = await getSession();
  if (!session) throw new Error("Nao autenticado");
  await markAllNotificationsRead(session.id);
  revalidatePath("/", "layout");
}
