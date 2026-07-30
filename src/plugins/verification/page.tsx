import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { workspaceProjectIds } from "@/lib/workspace";
import { writableMap } from "@/lib/projects";
import { PageHeader, EmptyState } from "@/components/ui";
import { VerificationClient } from "@/components/planning/verification-client";

export default async function VerificationPage() {
  const session = await requireUser();
  const ids = await workspaceProjectIds(session);
  if (ids.length === 0) return <EmptyState title="Nenhum projeto" description="Participe de um projeto para gerenciar V&V." />;

  const [cases, canWrite] = await Promise.all([
    prisma.verificationCase.findMany({
      where: { projectId: { in: ids } },
      include: { requirement: true, project: true },
      orderBy: { updatedAt: "desc" },
    }),
    writableMap(session, ids),
  ]);

  const writeByProject = canWrite;

  return (
    <div>
      <PageHeader title="Verificacao e validacao" description="Casos de V&V e matriz de verificacao de requisitos." />
      <VerificationClient
        canWrite={writeByProject}
        cases={cases.map((c) => ({
          id: c.id,
          name: c.name,
          method: c.method,
          status: c.status,
          projectId: c.projectId,
          requirement: { id: c.requirement.id, code: c.requirement.code, title: c.requirement.title },
          project: { key: c.project.key, color: c.project.color },
        }))}
      />
    </div>
  );
}
