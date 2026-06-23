import "server-only";
import { prisma } from "@/lib/db";
import { daysUntil } from "@/lib/utils";
import { createNotification } from "@/lib/notifications";

/** Hourly check for upcoming due dates — notifies assignees/leads. */
export async function checkDueDateNotifications() {
  const now = new Date();
  const horizon = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const tasks = await prisma.task.findMany({
    where: { status: { not: "done" }, dueDate: { lte: horizon, gte: now } },
    include: { assignees: true, project: true },
  });

  for (const t of tasks) {
    const days = daysUntil(t.dueDate);
    const label = days === 0 ? "vence hoje" : `vence em ${days}d`;
    const recipients = t.assignees.length > 0 ? t.assignees : [];
    if (recipients.length === 0) {
      const leads = await prisma.projectMembership.findMany({
        where: { projectId: t.projectId, role: "lead" },
        include: { user: true },
      });
      for (const m of leads) {
        await createNotification({
          userId: m.userId,
          kind: "due_task",
          title: `Tarefa ${label}`,
          message: t.title,
          href: `/board?project=${t.projectId}`,
        });
      }
    } else {
      for (const u of recipients) {
        await createNotification({
          userId: u.id,
          kind: "due_task",
          title: `Tarefa ${label}`,
          message: t.title,
          href: `/board?project=${t.projectId}`,
        });
      }
    }
  }

  const deliverables = await prisma.deliverable.findMany({
    where: { status: { notIn: ["accepted", "rejected"] }, dueDate: { lte: horizon, gte: now } },
    include: { project: true },
  });

  for (const d of deliverables) {
    const days = daysUntil(d.dueDate);
    const label = days === 0 ? "vence hoje" : `vence em ${days}d`;
    const leads = await prisma.projectMembership.findMany({
      where: { projectId: d.projectId, role: { in: ["lead", "contributor"] } },
    });
    for (const m of leads) {
      await createNotification({
        userId: m.userId,
        kind: "due_deliverable",
        title: `Entregavel ${label}`,
        message: d.name,
        href: "/deliverables",
      });
    }
  }
}

const g = globalThis as { __labflowDueCheck?: boolean };

export function startDueDateNotifier() {
  if (g.__labflowDueCheck || typeof setInterval === "undefined") return;
  g.__labflowDueCheck = true;

  setInterval(() => {
    checkDueDateNotifications().catch((err) => console.error("[notifications] due check failed", err));
  }, 60 * 60 * 1000);

  // First run after short delay
  setTimeout(() => {
    checkDueDateNotifications().catch((err) => console.error("[notifications] due check failed", err));
  }, 30_000);
}
