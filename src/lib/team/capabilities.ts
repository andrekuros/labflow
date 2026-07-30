import "server-only";
import { prisma } from "@/lib/db";
import { formatProfilesLabel, legacyRoleToProfiles, normalizeProfiles } from "@/lib/profile-meta";

export const LAB_CAPABILITIES_TITLE = "LabFlow — Mapa de capacidades da equipe";

export type MemberCapabilityRow = {
  userId: string;
  name: string;
  email: string;
  role: string;
  profilesLabel: string;
  projects: { key: string; name: string; role: string }[];
  academic: {
    program: string;
    status: string;
    objective: string;
    methodology: string;
    advisorName: string | null;
  } | null;
  taskStats: {
    total: number;
    done: number;
    inProgress: number;
    open: number;
    totalEstimateHours: number;
  };
  wbsAreas: string[];
  labelNames: string[];
  recentTasks: {
    title: string;
    status: string;
    priority: string;
    projectKey: string;
    workPackage: string | null;
  }[];
  activityCount90d: number;
  topActivityTypes: { type: string; count: number }[];
};

export type LabTeamCapabilityData = {
  generatedAt: Date;
  memberCount: number;
  members: MemberCapabilityRow[];
};

const ACTIVITY_WINDOW_DAYS = 90;

export async function fetchLabTeamCapabilityData(): Promise<LabTeamCapabilityData> {
  const since = new Date();
  since.setDate(since.getDate() - ACTIVITY_WINDOW_DAYS);

  const users = await prisma.user.findMany({
    where: { accountStatus: "active" },
    include: {
      profiles: { select: { profile: true } },
      academicProfile: true,
      memberships: { include: { project: { select: { key: true, name: true } } } },
      assignedTasks: {
        include: {
          project: { select: { key: true } },
          workPackage: { select: { code: true, name: true } },
          labels: { select: { name: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 40,
      },
    },
    orderBy: { name: "asc" },
  });

  const userIds = users.map((u) => u.id);
  const activityLogs =
    userIds.length > 0
      ? await prisma.activityLog.findMany({
          where: { actorId: { in: userIds }, createdAt: { gte: since } },
          select: { actorId: true, type: true },
        })
      : [];

  const activityByUser = new Map<string, Map<string, number>>();
  for (const log of activityLogs) {
    if (!log.actorId) continue;
    const map = activityByUser.get(log.actorId) ?? new Map<string, number>();
    map.set(log.type, (map.get(log.type) ?? 0) + 1);
    activityByUser.set(log.actorId, map);
  }

  const members: MemberCapabilityRow[] = [];

  for (const u of users) {
    const hasActivity =
      u.memberships.length > 0 || u.assignedTasks.length > 0 || activityByUser.has(u.id);
    if (!hasActivity) continue;

    const profiles = u.profiles.length
      ? normalizeProfiles(u.profiles.map((p) => p.profile))
      : legacyRoleToProfiles(u.role);

    const done = u.assignedTasks.filter((t) => t.status === "done").length;
    const inProgress = u.assignedTasks.filter((t) => t.status === "in_progress").length;
    const open = u.assignedTasks.filter((t) => t.status !== "done").length;
    const totalEstimateHours = u.assignedTasks.reduce((s, t) => s + (t.estimate ?? 0), 0);

    const wbsSet = new Set<string>();
    const labelSet = new Set<string>();
    for (const t of u.assignedTasks) {
      if (t.workPackage) {
        wbsSet.add(`${t.workPackage.code ?? ""} ${t.workPackage.name}`.trim());
      }
      for (const l of t.labels) labelSet.add(l.name);
    }

    const actMap = activityByUser.get(u.id) ?? new Map<string, number>();
    const topActivityTypes = [...actMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([type, count]) => ({ type, count }));

    members.push({
      userId: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      profilesLabel: formatProfilesLabel(profiles),
      projects: u.memberships.map((m) => ({
        key: m.project.key,
        name: m.project.name,
        role: m.role,
      })),
      academic: u.academicProfile
        ? {
            program: u.academicProfile.program,
            status: u.academicProfile.status,
            objective: u.academicProfile.objective,
            methodology: u.academicProfile.methodology,
            advisorName: u.academicProfile.advisorName,
          }
        : null,
      taskStats: {
        total: u.assignedTasks.length,
        done,
        inProgress,
        open,
        totalEstimateHours,
      },
      wbsAreas: [...wbsSet].slice(0, 12),
      labelNames: [...labelSet].slice(0, 10),
      recentTasks: u.assignedTasks.slice(0, 8).map((t) => ({
        title: t.title,
        status: t.status,
        priority: t.priority,
        projectKey: t.project.key,
        workPackage: t.workPackage
          ? `${t.workPackage.code ?? ""} ${t.workPackage.name}`.trim()
          : null,
      })),
      activityCount90d: [...actMap.values()].reduce((s, n) => s + n, 0),
      topActivityTypes,
    });
  }

  return {
    generatedAt: new Date(),
    memberCount: members.length,
    members,
  };
}

export function generateLabCapabilitiesMarkdown(data: LabTeamCapabilityData): string {
  const lines: string[] = [
    "# Mapa de capacidades da equipe",
    "",
    `> Documento interno do laboratorio · gerado em ${data.generatedAt.toLocaleString("pt-BR")} · ${data.memberCount} integrante(s) com atividade registrada`,
    "",
    "Este artigo consolida perfis, projetos e atividades para apoiar alocacao em novos projetos e sugestao de responsaveis por tarefa.",
    "",
    "---",
    "",
  ];

  for (const m of data.members) {
    lines.push(`## ${m.name}`);
    lines.push("");
    lines.push(`- **E-mail:** ${m.email}`);
    lines.push(`- **Papel global:** ${m.role}`);
    lines.push(`- **Perfis:** ${m.profilesLabel}`);
    if (m.projects.length > 0) {
      lines.push(
        `- **Projetos:** ${m.projects.map((p) => `${p.key} (${p.role})`).join(", ")}`,
      );
    }
    lines.push(
      `- **Tarefas:** ${m.taskStats.total} atribuidas · ${m.taskStats.done} concluidas · ${m.taskStats.open} abertas · ~${m.taskStats.totalEstimateHours}h estimadas`,
    );
    lines.push(`- **Atividade (90 dias):** ${m.activityCount90d} evento(s)`);

    if (m.academic) {
      lines.push(`- **Programa academico:** ${m.academic.program} [${m.academic.status}]`);
      if (m.academic.advisorName) lines.push(`- **Orientador:** ${m.academic.advisorName}`);
      if (m.academic.objective?.trim()) {
        lines.push(`- **Objetivo de pesquisa:** ${m.academic.objective.trim().slice(0, 300)}`);
      }
    }

    if (m.wbsAreas.length > 0) {
      lines.push(`- **Areas WBS trabalhadas:** ${m.wbsAreas.join("; ")}`);
    }
    if (m.labelNames.length > 0) {
      lines.push(`- **Categorias de tarefa:** ${m.labelNames.join(", ")}`);
    }

    if (m.recentTasks.length > 0) {
      lines.push("");
      lines.push("**Tarefas recentes**");
      lines.push("");
      lines.push("| Projeto | Tarefa | Status | Prioridade | WBS |");
      lines.push("|---------|--------|--------|------------|-----|");
      for (const t of m.recentTasks) {
        lines.push(
          `| ${t.projectKey} | ${t.title.replace(/\|/g, "/")} | ${t.status} | ${t.priority} | ${t.workPackage ?? "—"} |`,
        );
      }
    }

    if (m.topActivityTypes.length > 0) {
      lines.push("");
      lines.push(
        `**Tipos de atividade:** ${m.topActivityTypes.map((a) => `${a.type} (${a.count})`).join(", ")}`,
      );
    }

    lines.push("");
    lines.push("### Analise IA");
    lines.push("");
    lines.push("_(A ser preenchido pelo enriquecimento de IA)_");
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  lines.push("_Documento gerado automaticamente pelo LabFlow. Visivel apenas para administradores._");
  return lines.join("\n");
}

/** Replace IA placeholder sections with enriched content per member. */
export function mergeAiEnrichment(
  baseMarkdown: string,
  enrichments: { userId: string; name: string; analysis: string }[],
): string {
  let result = baseMarkdown;
  for (const e of enrichments) {
    const marker = `## ${e.name}\n\n`;
    const idx = result.indexOf(marker);
    if (idx === -1) continue;
    const sectionStart = idx + marker.length;
    const nextSection = result.indexOf("\n## ", sectionStart);
    const sectionEnd = nextSection === -1 ? result.length : nextSection;
    const section = result.slice(sectionStart, sectionEnd);
    const updated = section.replace(
      "### Analise IA\n\n_(A ser preenchido pelo enriquecimento de IA)_",
      `### Analise IA\n\n${e.analysis.trim()}`,
    );
    result = result.slice(0, sectionStart) + updated + result.slice(sectionEnd);
  }
  return result;
}
