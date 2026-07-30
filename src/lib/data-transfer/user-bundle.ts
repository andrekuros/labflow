import "server-only";
import { prisma } from "@/lib/db";
import { setUserProfiles, legacyRoleToProfiles } from "@/lib/user-profiles";
import {
  DATA_TRANSFER_VERSION,
  type UserDataBundle,
  type UserImportResult,
} from "@/lib/data-transfer/types";

function iso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

export async function exportUserBundle(userId: string): Promise<UserDataBundle> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: {
      profiles: { select: { profile: true } },
      academicProfile: true,
      memberships: { include: { project: { select: { key: true } } } },
    },
  });

  const profiles =
    user.profiles.length > 0
      ? user.profiles.map((p) => p.profile)
      : legacyRoleToProfiles(user.role);

  const academic = user.academicProfile;

  return {
    version: DATA_TRANSFER_VERSION,
    kind: "user",
    exportedAt: new Date().toISOString(),
    user: {
      email: user.email,
      name: user.name,
      passwordHash: user.passwordHash,
      role: user.role,
      accountStatus: user.accountStatus,
      avatarColor: user.avatarColor,
      preferences: user.preferences,
      approvedAt: iso(user.approvedAt),
      approvedBy: user.approvedBy,
    },
    profiles,
    academicProfile: academic
      ? {
          program: academic.program,
          status: academic.status,
          motivation: academic.motivation,
          objective: academic.objective,
          problemStatement: academic.problemStatement,
          hypothesis: academic.hypothesis,
          methodology: academic.methodology,
          academicContribution: academic.academicContribution,
          expectedResults: academic.expectedResults,
          limitations: academic.limitations,
          theoreticalFramework: academic.theoreticalFramework,
          advisorName: academic.advisorName,
          coAdvisorName: academic.coAdvisorName,
          startDate: iso(academic.startDate),
          expectedDefenseDate: iso(academic.expectedDefenseDate),
          coursesJson: academic.coursesJson,
          pendingJson: academic.pendingJson,
          notes: academic.notes,
          aiReviewsJson: academic.aiReviewsJson,
          aiReportJson: academic.aiReportJson,
        }
      : null,
    memberships: user.memberships.map((m) => ({
      projectKey: m.project.key,
      role: m.role,
    })),
  };
}

function parseBundle(raw: string): UserDataBundle {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("JSON invalido");
  }
  if (!data || typeof data !== "object") throw new Error("JSON invalido");
  const bundle = data as Partial<UserDataBundle>;
  if (bundle.kind !== "user" || bundle.version !== DATA_TRANSFER_VERSION) {
    throw new Error(`Formato invalido. Esperado user bundle v${DATA_TRANSFER_VERSION}`);
  }
  if (!bundle.user?.email || !bundle.user?.name) {
    throw new Error("Bundle sem dados do usuario (email, name)");
  }
  return bundle as UserDataBundle;
}

export async function importUserBundle(
  raw: string,
  opts: { mode?: "create" | "upsert" } = {},
): Promise<UserImportResult> {
  const bundle = parseBundle(raw);
  const mode = opts.mode ?? "upsert";
  const warnings: string[] = [];
  const email = bundle.user.email.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && mode === "create") {
    throw new Error(`Usuario ${email} ja existe. Use modo upsert ou outro email.`);
  }

  let userId: string;
  let created = false;

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        name: bundle.user.name,
        passwordHash: bundle.user.passwordHash,
        role: bundle.user.role,
        accountStatus: bundle.user.accountStatus,
        avatarColor: bundle.user.avatarColor,
        preferences: bundle.user.preferences,
        approvedAt: bundle.user.approvedAt ? new Date(bundle.user.approvedAt) : null,
        approvedBy: bundle.user.approvedBy,
      },
    });
    userId = existing.id;
  } else {
    const user = await prisma.user.create({
      data: {
        email,
        name: bundle.user.name,
        passwordHash: bundle.user.passwordHash,
        role: bundle.user.role,
        accountStatus: bundle.user.accountStatus,
        avatarColor: bundle.user.avatarColor,
        preferences: bundle.user.preferences,
        approvedAt: bundle.user.approvedAt ? new Date(bundle.user.approvedAt) : null,
        approvedBy: bundle.user.approvedBy,
      },
    });
    userId = user.id;
    created = true;
  }

  if (bundle.profiles?.length) {
    await setUserProfiles(userId, bundle.profiles);
  }

  if (bundle.academicProfile) {
    const ap = bundle.academicProfile;
    await prisma.academicProfile.upsert({
      where: { userId },
      create: {
        userId,
        program: ap.program,
        status: ap.status,
        motivation: ap.motivation,
        objective: ap.objective,
        problemStatement: ap.problemStatement,
        hypothesis: ap.hypothesis,
        methodology: ap.methodology,
        academicContribution: ap.academicContribution,
        expectedResults: ap.expectedResults,
        limitations: ap.limitations,
        theoreticalFramework: ap.theoreticalFramework,
        advisorName: ap.advisorName,
        coAdvisorName: ap.coAdvisorName,
        startDate: ap.startDate ? new Date(ap.startDate) : null,
        expectedDefenseDate: ap.expectedDefenseDate ? new Date(ap.expectedDefenseDate) : null,
        coursesJson: ap.coursesJson,
        pendingJson: ap.pendingJson,
        notes: ap.notes,
        aiReviewsJson: ap.aiReviewsJson,
        aiReportJson: ap.aiReportJson,
      },
      update: {
        program: ap.program,
        status: ap.status,
        motivation: ap.motivation,
        objective: ap.objective,
        problemStatement: ap.problemStatement,
        hypothesis: ap.hypothesis,
        methodology: ap.methodology,
        academicContribution: ap.academicContribution,
        expectedResults: ap.expectedResults,
        limitations: ap.limitations,
        theoreticalFramework: ap.theoreticalFramework,
        advisorName: ap.advisorName,
        coAdvisorName: ap.coAdvisorName,
        startDate: ap.startDate ? new Date(ap.startDate) : null,
        expectedDefenseDate: ap.expectedDefenseDate ? new Date(ap.expectedDefenseDate) : null,
        coursesJson: ap.coursesJson,
        pendingJson: ap.pendingJson,
        notes: ap.notes,
        aiReviewsJson: ap.aiReviewsJson,
        aiReportJson: ap.aiReportJson,
      },
    });
  }

  for (const m of bundle.memberships ?? []) {
    const project = await prisma.project.findUnique({ where: { key: m.projectKey.toUpperCase() } });
    if (!project) {
      warnings.push(`Projeto nao encontrado para membership: ${m.projectKey}`);
      continue;
    }
    await prisma.projectMembership.upsert({
      where: { userId_projectId: { userId, projectId: project.id } },
      create: { userId, projectId: project.id, role: m.role },
      update: { role: m.role },
    });
  }

  return { userId, email, created, warnings };
}
