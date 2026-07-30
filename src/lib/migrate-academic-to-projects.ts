import "server-only";
import { prisma } from "@/lib/db";
import {
  defaultFeaturesForKind,
  serializeProjectFeatures,
  type ProjectKind,
} from "@/lib/projects/features";
import {
  serializeAcademicMeta,
  parseAcademicMeta,
  type ProjectAcademicMeta,
} from "@/lib/projects/academic-meta";
import { serializePaperMeta, parsePaperMeta } from "@/lib/projects/paper-meta";
import { ensureProjectKindDefaults } from "@/lib/projects/features-server";

function slugKey(base: string, max = 8): string {
  const cleaned = base
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, max);
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

function profileHasContent(p: {
  motivation: string;
  objective: string;
  problemStatement: string;
  coursesJson: string;
  pendingJson: string;
}): boolean {
  if (p.motivation.trim() || p.objective.trim() || p.problemStatement.trim()) return true;
  try {
    const courses = JSON.parse(p.coursesJson || "[]") as unknown[];
    const pending = JSON.parse(p.pendingJson || "[]") as unknown[];
    return courses.length > 0 || pending.length > 0;
  } catch {
    return false;
  }
}

/** Idempotent: migrate leftover AcademicProfile methodology into thesis/dissertation projects. */
export async function migrateAcademicAndPublicationsToProjects(): Promise<{
  profiles: number;
  publications: number;
}> {
  await ensureProjectKindDefaults();
  let profiles = 0;

  const alreadyMigratedProfiles = await prisma.project.findMany({
    where: { kind: { in: ["thesis", "dissertation"] } },
    select: { academicJson: true },
  });
  const migratedUserIds = new Set(
    alreadyMigratedProfiles
      .map((p) => parseAcademicMeta(p.academicJson).migratedFromUserId)
      .filter(Boolean) as string[],
  );

  const academicProfiles = await prisma.academicProfile.findMany({
    include: { user: { select: { id: true, name: true } } },
  });

  for (const ap of academicProfiles) {
    if (migratedUserIds.has(ap.userId)) continue;
    if (!profileHasContent(ap) && ap.program !== "phd" && ap.program !== "msc") continue;

    const kind: ProjectKind = ap.program === "phd" ? "thesis" : "dissertation";
    const key = await uniqueProjectKey(
      kind === "thesis" ? `TE${ap.user.name.slice(0, 4)}` : `DI${ap.user.name.slice(0, 4)}`,
    );

    let courses: ProjectAcademicMeta["courses"] = [];
    let pending: ProjectAcademicMeta["pending"] = [];
    try {
      courses = JSON.parse(ap.coursesJson || "[]");
      pending = JSON.parse(ap.pendingJson || "[]");
    } catch {
      /* ignore */
    }

    const meta: ProjectAcademicMeta = {
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
        key,
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
    profiles += 1;
  }

  return { profiles, publications: 0 };
}
