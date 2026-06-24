import Link from "next/link";
import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { PageHeader, Card, Badge } from "@/components/ui";
import { AcademicProfileForm, profileToForm } from "@/components/academic/academic-client";
import { ensureAcademicProfile } from "@/plugins/academic/actions";
import { ChevronRight } from "lucide-react";

const STUDENT_ROLES = new Set(["phd", "msc", "student"]);

export default async function AcademicPage() {
  const session = await requireUser();
  const isStaff = session.role === "admin" || session.role === "researcher";

  if (isStaff) {
    const students = await prisma.user.findMany({
      where: { role: { in: ["phd", "msc", "student"] } },
      include: { academicProfile: true },
      orderBy: { name: "asc" },
    });

    return (
      <div>
        <PageHeader
          title="Acompanhamento academico"
          description="Metodologia cientifica, disciplinas e pendencias de mestrando/doutorando."
        />
        <Card className="divide-y divide-border">
          {students.length === 0 && <p className="p-4 text-sm text-muted">Nenhum aluno cadastrado.</p>}
          {students.map((u) => (
            <Link
              key={u.id}
              href={`/academic?user=${u.id}`}
              className="flex items-center justify-between p-4 transition hover:bg-surface2"
            >
              <div>
                <p className="font-medium">{u.name}</p>
                <p className="text-xs text-muted">{u.title ?? u.role}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-surface2 text-muted">
                  {u.academicProfile?.program === "phd" ? "Doutorado" : u.academicProfile ? "Mestrado" : "Sem perfil"}
                </Badge>
                <ChevronRight size={16} className="text-muted" />
              </div>
            </Link>
          ))}
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
        writable
      />
    </div>
  );
}

export async function AcademicUserPage(userId: string, session: { id: string; role: string; name: string }) {
  const isStaff = session.role === "admin" || session.role === "researcher";
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target || !STUDENT_ROLES.has(target.role)) return null;

  const profile = await ensureAcademicProfile(userId);
  const writable = isStaff || session.id === userId;

  return (
    <div>
      <PageHeader title={target.name} description="Perfil academico do aluno." />
      <AcademicProfileForm
        userId={userId}
        userName={target.name}
        initial={profileToForm(profile)}
        writable={writable}
      />
    </div>
  );
}
