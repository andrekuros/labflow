"use server";

import { prisma } from "@/lib/db";
import { requireUser, hasPermission } from "@/lib/rbac";
import { emit } from "@/lib/events";
import { redirect } from "next/navigation";

export type FeedbackInput = {
  title: string;
  description: string;
  category: "bug" | "suggestion" | "question";
  platformUrl?: string;
};

export async function submitFeedback(data: FeedbackInput) {
  const user = await requireUser();
  const ok = await hasPermission(user, "feedback:create");
  if (!ok) return { error: "Sem permissao" };

  const fb = await prisma.feedback.create({
    data: {
      title: data.title.trim(),
      description: data.description.trim(),
      category: data.category,
      platformUrl: data.platformUrl || null,
      submittedById: user.id,
    },
  });

  await emit({
    type: "feedback.submitted",
    actorId: user.id,
    payload: { id: fb.id, title: fb.title, description: fb.description, category: fb.category, platformUrl: fb.platformUrl },
  });

  return { id: fb.id };
}

export async function listFeedbacks() {
  const user = await requireUser();
  const canManage = await hasPermission(user, "feedback:manage");

  if (canManage) {
    return prisma.feedback.findMany({
      orderBy: { createdAt: "desc" },
      include: { submittedBy: { select: { id: true, name: true, email: true } } },
    });
  }

  return prisma.feedback.findMany({
    where: { submittedById: user.id },
    orderBy: { createdAt: "desc" },
    include: { submittedBy: { select: { id: true, name: true, email: true } } },
  });
}

export async function updateFeedbackStatus(id: string, status: string) {
  const user = await requireUser();
  const ok = await hasPermission(user, "feedback:manage");
  if (!ok) redirect("/");

  await prisma.feedback.update({ where: { id }, data: { status } });
}
