"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { emit } from "@/lib/events";
import { createNotification } from "@/lib/notifications";

export async function createChannel(input: { name: string; description?: string; projectId?: string | null }) {
  const session = await getSession();
  if (!session) throw new Error("Nao autenticado");
  const c = await prisma.channel.create({
    data: { name: input.name, description: input.description || null, projectId: input.projectId || null },
  });
  revalidatePath("/forum");
  return c;
}

export async function createThread(input: { channelId: string; title: string; content: string }) {
  const session = await getSession();
  if (!session) throw new Error("Nao autenticado");
  const channel = await prisma.channel.findUnique({ where: { id: input.channelId } });
  const thread = await prisma.thread.create({
    data: {
      channelId: input.channelId,
      authorId: session.id,
      title: input.title,
      posts: { create: { authorId: session.id, content: input.content } },
    },
  });
  await emit({ type: "thread.created", actorId: session.id, projectId: channel?.projectId ?? null, payload: { id: thread.id, title: input.title, content: input.content } });
  revalidatePath("/forum");
  return thread;
}

export async function createPost(input: { threadId: string; content: string }) {
  const session = await getSession();
  if (!session) throw new Error("Nao autenticado");
  const thread = await prisma.thread.findUnique({
    where: { id: input.threadId },
    include: { channel: true, posts: { select: { authorId: true } } },
  });
  const post = await prisma.post.create({ data: { threadId: input.threadId, authorId: session.id, content: input.content } });
  await prisma.thread.update({ where: { id: input.threadId }, data: { updatedAt: new Date() } });
  await emit({ type: "post.created", actorId: session.id, projectId: thread?.channel.projectId ?? null, payload: { id: post.id, content: input.content } });

  if (thread) {
    const recipientIds = new Set<string>();
    if (thread.authorId && thread.authorId !== session.id) recipientIds.add(thread.authorId);
    for (const p of thread.posts) {
      if (p.authorId && p.authorId !== session.id) recipientIds.add(p.authorId);
    }
    await Promise.all(
      [...recipientIds].map((userId) =>
        createNotification({
          userId,
          kind: "forum_reply",
          title: "Nova resposta no forum",
          message: thread.title,
          href: `/forum/${thread.id}`,
        }),
      ),
    );
  }

  revalidatePath(`/forum/${input.threadId}`);
  return post;
}

export async function setThreadStatus(threadId: string, status: string) {
  const session = await getSession();
  if (!session) throw new Error("Nao autenticado");
  await prisma.thread.update({ where: { id: threadId }, data: { status } });
  revalidatePath(`/forum/${threadId}`);
}

export async function fetchPosts(threadId: string) {
  const posts = await prisma.post.findMany({
    where: { threadId },
    include: { author: true },
    orderBy: { createdAt: "asc" },
  });
  return posts.map((p) => ({
    id: p.id,
    content: p.content,
    createdAt: p.createdAt.toISOString(),
    authorName: p.author?.name ?? "Desconhecido",
    authorColor: p.author?.avatarColor ?? "#6366f1",
  }));
}
