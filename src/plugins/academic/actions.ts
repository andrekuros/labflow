"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { emit } from "@/lib/events";
import { indexAcademicProfile } from "@/lib/ai/knowledge-indexer";

export type CourseRow = { code: string; name: string; status: string; grade?: string };
export type PendingRow = { title: string; kind: string; status: string; dueDate?: string };

export type AcademicFormData = {
  program: string;
  status: string;
  motivation: string;
  objective: string;
  problemStatement: string;
  hypothesis: string;
  methodology: string;
  academicContribution: string;
  expectedResults: string;
  limitations: string;
  theoreticalFramework: string;
  advisorName: string;
  coAdvisorName: string;
  startDate: string;
  expectedDefenseDate: string;
  courses: CourseRow[];
  pending: PendingRow[];
  notes: string;
};

function canEditProfile(session: { id: string; role: string }, userId: string) {
  if (session.id === userId) return true;
  return session.role === "admin" || session.role === "researcher" || session.role === "project_manager";
}

export async function saveAcademicProfile(userId: string, data: AcademicFormData) {
  const session = await getSession();
  if (!session) throw new Error("Nao autenticado");
  if (!canEditProfile(session, userId)) throw new Error("Sem permissao");

  await prisma.academicProfile.upsert({
    where: { userId },
    create: {
      userId,
      program: data.program,
      status: data.status,
      motivation: data.motivation,
      objective: data.objective,
      problemStatement: data.problemStatement,
      hypothesis: data.hypothesis,
      methodology: data.methodology,
      academicContribution: data.academicContribution,
      expectedResults: data.expectedResults,
      limitations: data.limitations,
      theoreticalFramework: data.theoreticalFramework,
      advisorName: data.advisorName || null,
      coAdvisorName: data.coAdvisorName || null,
      startDate: data.startDate ? new Date(data.startDate) : null,
      expectedDefenseDate: data.expectedDefenseDate ? new Date(data.expectedDefenseDate) : null,
      coursesJson: JSON.stringify(data.courses),
      pendingJson: JSON.stringify(data.pending),
      notes: data.notes,
    },
    update: {
      program: data.program,
      status: data.status,
      motivation: data.motivation,
      objective: data.objective,
      problemStatement: data.problemStatement,
      hypothesis: data.hypothesis,
      methodology: data.methodology,
      academicContribution: data.academicContribution,
      expectedResults: data.expectedResults,
      limitations: data.limitations,
      theoreticalFramework: data.theoreticalFramework,
      advisorName: data.advisorName || null,
      coAdvisorName: data.coAdvisorName || null,
      startDate: data.startDate ? new Date(data.startDate) : null,
      expectedDefenseDate: data.expectedDefenseDate ? new Date(data.expectedDefenseDate) : null,
      coursesJson: JSON.stringify(data.courses),
      pendingJson: JSON.stringify(data.pending),
      notes: data.notes,
    },
  });

  await indexAcademicProfile(userId).catch(() => {});
  await emit({ type: "academic.updated", actorId: session.id, targetId: userId, payload: { userId } });
  revalidatePath("/academic");
}

export async function ensureAcademicProfile(userId: string) {
  const existing = await prisma.academicProfile.findUnique({ where: { userId } });
  if (existing) return existing;
  return prisma.academicProfile.create({ data: { userId } });
}
