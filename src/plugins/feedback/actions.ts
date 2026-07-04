"use server";

import { prisma } from "@/lib/db";
import { requireUser, hasPermission } from "@/lib/rbac";
import { emit } from "@/lib/events";
import { redirect } from "next/navigation";

export type FeedbackCategory = "bug" | "suggestion" | "question" | "equipment";

export type FeedbackInput = {
  title: string;
  description: string;
  category: FeedbackCategory;
  platformUrl?: string;
};

const FEEDBACK_INCLUDE = {
  submittedBy: { select: { id: true, name: true, email: true } },
  assignee: { select: { id: true, name: true, email: true } },
  comments: {
    orderBy: { createdAt: "asc" as const },
    include: { author: { select: { id: true, name: true } } },
  },
} as const;

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

  const where = canManage ? {} : { submittedById: user.id };
  return prisma.feedback.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: FEEDBACK_INCLUDE,
  });
}

export async function updateFeedbackStatus(id: string, status: string) {
  const user = await requireUser();
  const ok = await hasPermission(user, "feedback:manage");
  if (!ok) redirect("/");

  await prisma.feedback.update({ where: { id }, data: { status } });
}

export async function assignFeedback(id: string, assigneeId: string | null) {
  const user = await requireUser();
  const ok = await hasPermission(user, "feedback:manage");
  if (!ok) redirect("/");

  await prisma.feedback.update({
    where: { id },
    data: { assigneeId, status: assigneeId ? "in_progress" : undefined },
  });
}

export async function addFeedbackComment(feedbackId: string, content: string) {
  const user = await requireUser();
  if (!content.trim()) return { error: "Comentario vazio" };

  const fb = await prisma.feedback.findUnique({ where: { id: feedbackId } });
  if (!fb) return { error: "Feedback nao encontrado" };

  const canManage = await hasPermission(user, "feedback:manage");
  if (!canManage && fb.submittedById !== user.id) return { error: "Sem permissao" };

  const comment = await prisma.feedbackComment.create({
    data: { feedbackId, authorId: user.id, content: content.trim() },
    include: { author: { select: { id: true, name: true } } },
  });

  return comment;
}

export async function listUsers() {
  const user = await requireUser();
  const ok = await hasPermission(user, "feedback:manage");
  if (!ok) return [];

  return prisma.user.findMany({
    where: { accountStatus: "active" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}
