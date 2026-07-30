import Link from "next/link";
import { requireUser } from "@/lib/rbac";
import { canViewAcademicProfiles } from "@/lib/user-access";
import { prisma } from "@/lib/db";
import { PageHeader, Card, Badge } from "@/components/ui";
import { AcademicProfileForm } from "@/components/academic/academic-client";
import { ensureAcademicProfile } from "@/plugins/academic/actions";
import { profileToForm } from "@/lib/academic-profile-form";
import { parseAcademicReviews } from "@/lib/academic/reviews";
import { parseAcademicReport } from "@/lib/academic/report";
import { academicProgramTypeLabel } from "@/lib/academic-program-meta";
import { formatProfilesLabel, legacyRoleToProfiles, normalizeProfiles } from "@/lib/profile-meta";
import { ChevronRight } from "lucide-react";

const TRACKED_PROFILES = ["msc", "phd", "postdoc", "student"] as const;
const TRACKED_ROLES = ["msc", "phd", "postdoc", "student"] as const;

function userProfilesLabel(user: { role: string; profiles: { profile: string }[] }) {
  const profiles = user.profiles.length
    ? normalizeProfiles(user.profiles.map((p) => p.profile))
    : legacyRoleToProfiles(user.role);
  return formatProfilesLabel(profiles);
}

export default async function AcademicPage() {
  const session = await requireUser();
  const isStaff = canViewAcademicProfiles(session);

  if (isStaff) {
    const students = await prisma.user.findMany({
      where: {
        accountStatus: "active",
        OR: [
          { profiles: { some: { profile: { in: [...TRACKED_PROFILES] } } } },
          { role: { in: [...TRACKED_ROLES] } },
        ],
      },
      include: { academicProfile: true, profiles: { select: { profile: true } } },
      orderBy: { name: "asc" },
    });

    return (
      <div>
        <PageHeader
          title="Acompanhamento academico"
          description="Metodologia cientifica, disciplinas e pendencias de mestrando/doutorando."
        />
        <Card className="divide-y divide-border">
          {students.length === 0 && (
            <p className="p-4 text-sm text-muted">
              Nenhum aluno com perfil academico (mestrando, doutorando, pos-doc ou IC).
            </p>
          )}
          {students.map((u) => {
            const hasData = Boolean(
              u.academicProfile &&
                ((u.academicProfile.objective ?? "").trim() ||
                  (u.academicProfile.motivation ?? "").trim() ||
                  u.academicProfile.coursesJson !== "[]" ||
                  u.academicProfile.pendingJson !== "[]"),
            );
            const program = u.academicProfile?.program;
            return (
              <Link
                key={u.id}
                href={`/academic?user=${u.id}`}
                className="flex items-center justify-between p-4 transition hover:bg-surface2"
              >
                <div>
                  <p className="font-medium">{u.name}</p>
                  <p className="text-xs text-muted">{userProfilesLabel(u)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-surface2 text-muted">
                    {program ? academicProgramTypeLabel(program) : "Sem programa"}
                  </Badge>
                  {!hasData && (
                    <Badge className="bg-amber-500/15 text-amber-600">Sem dados</Badge>
                  )}
                  <ChevronRight size={16} className="text-muted" />
                </div>
              </Link>
            );
          })}
        </Card>
      </div>
    );
  }

  const profile = await ensureAcademicProfile(session.id);
  return (
    <div>
      <PageHeader
        title="Meu acompanhamento academico"
        description="Preencha sua metodologia cientifica, disciplinas e pendencias."
      />
      <AcademicProfileForm
        userId={session.id}
        userName={session.name}
        initial={profileToForm(profile)}
        initialReviews={parseAcademicReviews(profile.aiReviewsJson)}
        initialReport={parseAcademicReport(profile.aiReportJson)}
        writable
        canEditProgram={false}
      />
    </div>
  );
}

export async function AcademicUserPage(userId: string, session: { id: string; role: string; name: string }) {
  const isStaff = canViewAcademicProfiles(session);
  const target = await prisma.user.findUnique({
    where: { id: userId },
    include: { academicProfile: true, profiles: { select: { profile: true } } },
  });
  if (!target) return null;

  const profile = await ensureAcademicProfile(userId);
  const writable = isStaff || session.id === userId;
  const canEditProgram = isStaff && session.id !== userId;

  return (
    <div>
      <PageHeader
        title={target.name}
        description={`Perfil academico · ${userProfilesLabel(target)}`}
      />
      <AcademicProfileForm
        userId={userId}
        userName={target.name}
        initial={profileToForm(profile)}
        initialReviews={parseAcademicReviews(profile.aiReviewsJson)}
        initialReport={parseAcademicReport(profile.aiReportJson)}
        writable={writable}
        canEditProgram={canEditProgram}
      />
    </div>
  );
}
