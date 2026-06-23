import Link from "next/link";
import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { Card, Avatar, Badge, PageHeader } from "@/components/ui";
import { NewUserButton, RoleControl, ROLES } from "@/components/team/team-client";
import { ChevronRight } from "lucide-react";

export default async function TeamPage() {
  const session = await requireUser();
  const isAdmin = session.role === "admin";

  const users = await prisma.user.findMany({
    include: {
      _count: { select: { memberships: true, assignedTasks: true } },
      memberships: { include: { project: true } },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <PageHeader
        title="Equipe"
        description="Pesquisadores, doutorandos, mestrandos e alunos do laboratorio."
        actions={isAdmin ? <NewUserButton /> : undefined}
      />

      <Card className="divide-y divide-border">
        {users.map((u) => (
          <div key={u.id} className="flex flex-wrap items-center gap-4 p-4">
            <Link href={`/team/${u.id}`} className="flex min-w-0 flex-1 flex-wrap items-center gap-4 transition hover:opacity-90">
              <Avatar name={u.name} color={u.avatarColor} />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{u.name}</p>
                <p className="text-xs text-muted">{u.email}{u.title ? ` - ${u.title}` : ""}</p>
              </div>
              <div className="flex flex-wrap gap-1">
                {u.memberships.map((m) => <Badge key={m.id} color={m.project.color}>{m.project.key}</Badge>)}
              </div>
              <span className="text-xs text-muted">{u._count.assignedTasks} tarefas</span>
            </Link>
            <div className="flex items-center gap-2">
              {isAdmin ? (
                <RoleControl userId={u.id} role={u.role} />
              ) : (
                <Badge className="bg-surface2 text-muted">{ROLES[u.role] ?? u.role}</Badge>
              )}
              <Link href={`/team/${u.id}`} className="rounded-lg p-1 text-muted hover:bg-surface2 hover:text-fg">
                <ChevronRight size={16} />
              </Link>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
