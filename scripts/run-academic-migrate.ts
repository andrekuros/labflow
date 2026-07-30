#!/usr/bin/env npx tsx
/** One-shot CLI: migrate leftover AcademicProfile methodology into thesis/dissertation projects. */
import { PrismaClient } from "@prisma/client";
import {
  defaultFeaturesForKind,
  serializeProjectFeatures,
  type ProjectKind,
} from "../src/lib/projects/features";
import {
  serializeAcademicMeta,
  parseAcademicMeta,
  type ProjectAcademicMeta,
  EMPTY_ACADEMIC_META,
} from "../src/lib/projects/academic-meta";
import { serializePaperMeta, parsePaperMeta } from "../src/lib/projects/paper-meta";

const prisma = new PrismaClient();

function slugKey(base: string, max = 8): string {
  const cleaned = base.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, max);
  return cleaned || "PROJ";
}

async function uniqueProjectKey(base: string): Promise<string> {
  let key = slugKey(base);
  let n = 0;
  while (await prisma.project.findUnique({ where: { key } })) {
    n += 1;
    const suffix = String(n);
    key = slugKey(base).slice(0, 8 - suffix.length) + suffix;
  }
  return key;
}

async function main() {
  const already = await prisma.project.findMany({
    where: { kind: { in: ["thesis", "dissertation"] } },
    select: { academicJson: true },
  });
  const migratedUsers = new Set(
    already.map((p) => parseAcademicMeta(p.academicJson).migratedFromUserId).filter(Boolean),
  );

  const academicProfiles = await prisma.academicProfile.findMany({
    include: { user: { select: { id: true, name: true } } },
  });

  let profilesMigrated = 0;
  for (const ap of academicProfiles) {
    if (migratedUsers.has(ap.userId)) continue;
    const hasContent =
      ap.motivation.trim() ||
      ap.objective.trim() ||
      ap.problemStatement.trim() ||
      ap.program === "phd" ||
      ap.program === "msc";
    if (!hasContent) continue;

    const kind: ProjectKind = ap.program === "phd" ? "thesis" : "dissertation";
    let courses: ProjectAcademicMeta["courses"] = [];
    let pending: ProjectAcademicMeta["pending"] = [];
    try {
      courses = JSON.parse(ap.coursesJson || "[]");
      pending = JSON.parse(ap.pendingJson || "[]");
    } catch {
      /* ignore */
    }

    const meta: ProjectAcademicMeta = {
      ...EMPTY_ACADEMIC_META,
      motivation: ap.motivation,
      objective: ap.objective,
      problemStatement: ap.problemStatement,
      hypothesis: ap.hypothesis,
      methodology: ap.methodology,
      theoreticalFramework: ap.theoreticalFramework,
      academicContribution: ap.academicContribution,
      expectedResults: ap.expectedResults,
      limitations: ap.limitations,
      notes: ap.notes,
      advisorName: ap.advisorName ?? "",
      coAdvisorName: ap.coAdvisorName ?? "",
      startDate: ap.startDate?.toISOString() ?? null,
      expectedDefenseDate: ap.expectedDefenseDate?.toISOString() ?? null,
      courses,
      pending,
      aiReviewsJson: ap.aiReviewsJson,
      aiReportJson: ap.aiReportJson,
      migratedFromUserId: ap.userId,
    };

    await prisma.project.create({
      data: {
        key: await uniqueProjectKey(kind === "thesis" ? `TE${ap.user.name.slice(0, 4)}` : `DI${ap.user.name.slice(0, 4)}`),
        name: kind === "thesis" ? `Tese — ${ap.user.name}` : `Dissertacao — ${ap.user.name}`,
        description: ap.objective || null,
        kind,
        color: kind === "thesis" ? "#7c3aed" : "#2563eb",
        featuresJson: serializeProjectFeatures(defaultFeaturesForKind(kind)),
        academicJson: serializeAcademicMeta(meta),
        paperJson: serializePaperMeta(parsePaperMeta("{}")),
        memberships: { create: { userId: ap.userId, role: "lead" } },
      },
    });

    await prisma.academicProfile.update({
      where: { id: ap.id },
      data: {
        motivation: "",
        objective: "",
        problemStatement: "",
        hypothesis: "",
        methodology: "",
        theoreticalFramework: "",
        academicContribution: "",
        expectedResults: "",
        limitations: "",
        notes: "",
        coursesJson: "[]",
        pendingJson: "[]",
        aiReviewsJson: "{}",
        aiReportJson: "{}",
      },
    });
    profilesMigrated += 1;
  }

  // Ensure lab projects have features defaults
  const labs = await prisma.project.findMany({
    where: { OR: [{ featuresJson: "{}" }, { featuresJson: "" }] },
    select: { id: true, kind: true },
  });
  for (const p of labs) {
    const kind = (["lab", "admin", "thesis", "dissertation", "paper"].includes(p.kind)
      ? p.kind
      : "lab") as ProjectKind;
    await prisma.project.update({
      where: { id: p.id },
      data: { kind, featuresJson: serializeProjectFeatures(defaultFeaturesForKind(kind)) },
    });
  }

  console.log({ profilesMigrated, labsUpdated: labs.length });
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
