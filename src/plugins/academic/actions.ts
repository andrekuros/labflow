"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { emit } from "@/lib/events";
import { indexAcademicProfile } from "@/lib/ai/knowledge-indexer";
import {
  applyProgramToProfiles,
  isAcademicProgram,
  resolveAcademicProgram,
  syncAcademicProfileProgram,
} from "@/lib/academic-program";
import { canViewAcademicProfiles } from "@/lib/user-access";
import { getUserProfileKeys, setUserProfiles } from "@/lib/user-profiles";
import type { SessionUser } from "@/lib/auth";
import { reviewAcademicFieldContent } from "@/lib/ai/academic-reviewer";
import { generateAcademicFinalReportContent } from "@/lib/ai/academic-final-report";
import { type AcademicFinalReport, parseAcademicReport, serializeAcademicReport } from "@/lib/academic/report";
import { ACADEMIC_REVIEW_FIELDS, parseAcademicReviews, type AcademicFieldReview, type AcademicReviewFieldKey, type AcademicReviews } from "@/lib/academic/reviews";

export type { AcademicFieldReview, AcademicReviewFieldKey, AcademicReviews, AcademicFinalReport };
export { parseAcademicReviews, parseAcademicReport };

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

function canEditProfile(session: SessionUser, userId: string) {
  if (session.id === userId) return true;
  return canViewAcademicProfiles(session);
}

function canRequestAcademicReview(session: SessionUser, userId: string) {
  if (session.id === userId) return true;
  return canViewAcademicProfiles(session);
}

function canEditProgram(session: SessionUser, userId: string) {
  return session.id !== userId && canViewAcademicProfiles(session);
}

async function resolveProgramForSave(
  session: SessionUser,
  userId: string,
  submittedProgram: string,
) {
  const profiles = await getUserProfileKeys(userId);
  const fromProfiles = resolveAcademicProgram(profiles);

  if (canEditProgram(session, userId) && isAcademicProgram(submittedProgram) && submittedProgram !== fromProfiles) {
    const nextProfiles = applyProgramToProfiles(profiles, submittedProgram);
    await setUserProfiles(userId, nextProfiles);
    return submittedProgram;
  }

  return fromProfiles;
}

const profileFields = (program: string, data: AcademicFormData) => ({
  program,
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
});

export async function saveAcademicProfile(userId: string, data: AcademicFormData) {
  const session = await getSession();
  if (!session) throw new Error("Nao autenticado");
  if (!canEditProfile(session, userId)) throw new Error("Sem permissao");

  const program = await resolveProgramForSave(session, userId, data.program);
  const fields = profileFields(program, data);

  await prisma.academicProfile.upsert({
    where: { userId },
    create: { userId, ...fields },
    update: fields,
  });

  await indexAcademicProfile(userId).catch(() => {});
  await emit({ type: "academic.updated", actorId: session.id, targetId: userId, payload: { userId } });
  revalidatePath("/academic");
  revalidatePath("/team");
}

export async function ensureAcademicProfile(userId: string) {
  const profiles = await getUserProfileKeys(userId);
  return syncAcademicProfileProgram(userId, profiles);
}

async function persistFieldReview(userId: string, field: AcademicReviewFieldKey, review: AcademicFieldReview) {
  const profile = await prisma.academicProfile.findUnique({ where: { userId } });
  const reviews = parseAcademicReviews(profile?.aiReviewsJson);
  reviews[field] = review;
  await prisma.academicProfile.update({
    where: { userId },
    data: { aiReviewsJson: JSON.stringify(reviews) },
  });
}

function peerContext(data: AcademicFormData, exclude: AcademicReviewFieldKey) {
  const ctx: Partial<Record<AcademicReviewFieldKey, string>> = {};
  for (const key of ACADEMIC_REVIEW_FIELDS) {
    if (key === exclude) continue;
    const val = data[key];
    if (typeof val === "string" && val.trim()) ctx[key] = val;
  }
  return ctx;
}

export async function reviewAcademicField(
  userId: string,
  field: AcademicReviewFieldKey,
  data: AcademicFormData,
): Promise<{ error?: string; review?: AcademicFieldReview }> {
  const session = await getSession();
  if (!session) return { error: "Nao autenticado" };
  if (!canRequestAcademicReview(session, userId)) return { error: "Sem permissao" };
  if (!ACADEMIC_REVIEW_FIELDS.includes(field)) return { error: "Campo invalido" };

  await ensureAcademicProfile(userId);

  const content = data[field];
  const review = await reviewAcademicFieldContent(
    field,
    content,
    data.program,
    peerContext(data, field),
  );

  await persistFieldReview(userId, field, review);
  revalidatePath("/academic");
  return { review };
}

export async function reviewAllAcademicFields(
  userId: string,
  data: AcademicFormData,
): Promise<{ error?: string; reviews?: AcademicReviews }> {
  const session = await getSession();
  if (!session) return { error: "Nao autenticado" };
  if (!canRequestAcademicReview(session, userId)) return { error: "Sem permissao" };

  await ensureAcademicProfile(userId);

  const reviews: AcademicReviews = { ...parseAcademicReviews((await prisma.academicProfile.findUnique({ where: { userId } }))?.aiReviewsJson) };

  for (const field of ACADEMIC_REVIEW_FIELDS) {
    const review = await reviewAcademicFieldContent(
      field,
      data[field],
      data.program,
      peerContext(data, field),
    );
    reviews[field] = review;
  }

  await prisma.academicProfile.update({
    where: { userId },
    data: { aiReviewsJson: JSON.stringify(reviews) },
  });

  revalidatePath("/academic");
  return { reviews };
}

export async function generateAcademicFinalReport(
  userId: string,
  data: AcademicFormData,
): Promise<{ error?: string; report?: AcademicFinalReport }> {
  const session = await getSession();
  if (!session) return { error: "Nao autenticado" };
  if (!canRequestAcademicReview(session, userId)) return { error: "Sem permissao" };

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
  if (!user) return { error: "Usuario nao encontrado" };

  await ensureAcademicProfile(userId);

  const profile = await prisma.academicProfile.findUnique({ where: { userId } });
  const reviews = parseAcademicReviews(profile?.aiReviewsJson);

  const { markdown, reviewer } = await generateAcademicFinalReportContent({
    userName: user.name,
    data,
    reviews,
  });

  const report: AcademicFinalReport = {
    markdown,
    generatedAt: new Date().toISOString(),
    reviewer,
  };

  await prisma.academicProfile.update({
    where: { userId },
    data: { aiReportJson: serializeAcademicReport(report) },
  });

  revalidatePath("/academic");
  return { report };
}
