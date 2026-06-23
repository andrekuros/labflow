import "server-only";
import { prisma } from "@/lib/db";

export type NotificationKind = "sync_error" | "due_task" | "due_deliverable" | "forum_reply";

export async function createNotification(input: {
  userId: string;
  kind: NotificationKind;
  title: string;
  message?: string;
  href?: string;
}) {
  // Dedupe: same user + kind + href in the last 24h
  if (input.href) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const existing = await prisma.notification.findFirst({
      where: { userId: input.userId, kind: input.kind, href: input.href, createdAt: { gte: since } },
    });
    if (existing) return existing;
  }

  return prisma.notification.create({
    data: {
      userId: input.userId,
      kind: input.kind,
      title: input.title,
      message: input.message ?? "",
      href: input.href ?? null,
    },
  });
}

export async function notifyAdmins(input: Omit<Parameters<typeof createNotification>[0], "userId">) {
  const admins = await prisma.user.findMany({ where: { role: "admin" }, select: { id: true } });
  await Promise.all(admins.map((a) => createNotification({ ...input, userId: a.id })));
}

export async function listNotifications(userId: string, limit = 20) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function unreadCount(userId: string) {
  return prisma.notification.count({ where: { userId, read: false } });
}

export async function markNotificationRead(id: string, userId: string) {
  await prisma.notification.updateMany({ where: { id, userId }, data: { read: true } });
}

export async function markAllNotificationsRead(userId: string) {
  await prisma.notification.updateMany({ where: { userId, read: false }, data: { read: true } });
}
