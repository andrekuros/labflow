import "server-only";
import { prisma } from "@/lib/db";
import { chat, type ChatMessage } from "@/lib/ai/provider";
import { ARTIFACTS_FORMAT_VERSION } from "@/lib/artifacts/schema";
import { loadProjectContextForAi } from "@/lib/ai/project-context";

export type SprintPlannerInput = {
  projectId: string;
  name: string;
  durationWeeks: number;
  startDate?: string | null;
  endDate?: string | null;
  teamMemberIds: string[];
};

export type SprintPlanSuggestedTask = {
  taskId: string;
  rationale: string;
  suggestedAssigneeId?: string;
};

export type SprintPlanDraft = {
  version: string;
  sprint: {
    name: string;
    goal: string;
    startDate?: string;
    endDate?: string;
    durationWeeks: number;
  };
  teamMemberIds: string[];
  suggestedTasks: SprintPlanSuggestedTask[];
  capacityNotes?: string;
};

export type SprintPlannerContext = {
  project: { id: string; key: string; name: string };
  sprintCount: number;
  defaultDurationWeeks: number;
  members: {
    userId: string;
    name: string;
    role: string;
    profilesLabel: string;
    openTaskCount: number;
  }[];
  eligibleTasks: {
    id: string;
    title: string;
    status: string;
    priority: string;
    estimate: number | null;
    dueDate: string | null;
    workPackageCode: string | null;
    workPackageName: string | null;
    assigneeNames: string;
  }[];
};

const LAB_CAPABILITIES_TITLE = "LabFlow — Mapa de capacidades da equipe";

export async function loadSprintPlannerContext(projectId: string): Promise<SprintPlannerContext> {
  const { getPluginSettings } = await import("@/plugins/registry");
  const { formatProfilesLabel, legacyRoleToProfiles, normalizeProfiles } = await import(
    "@/lib/profile-meta"
  );

  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    select: {
      id: true,
      key: true,
      name: true,
      _count: { select: { sprints: true } },
      memberships: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              role: true,
              profiles: { select: { profile: true } },
              _count: {
                select: {
                  assignedTasks: {
                    where: { projectId, status: { not: "done" } },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  const tasks = await prisma.task.findMany({
    where: {
      projectId,
      sprintId: null,
      status: { not: "done" },
    },
    include: {
      assignees: { select: { name: true } },
      workPackage: { select: { code: true, name: true } },
    },
    orderBy: [{ priority: "desc" }, { dueDate: "asc" }, { updatedAt: "desc" }],
    take: 80,
  });

  const settings = getPluginSettings("sprints");
  const defaultDurationWeeks =
    typeof settings.defaultDurationWeeks === "number" && settings.defaultDurationWeeks > 0
      ? settings.defaultDurationWeeks
      : 2;

  return {
    project: { id: project.id, key: project.key, name: project.name },
    sprintCount: project._count.sprints,
    defaultDurationWeeks,
    members: project.memberships.map((m) => {
      const profiles = m.user.profiles.length
        ? normalizeProfiles(m.user.profiles.map((p) => p.profile))
        : legacyRoleToProfiles(m.user.role);
      return {
        userId: m.user.id,
        name: m.user.name,
        role: m.role,
        profilesLabel: formatProfilesLabel(profiles),
        openTaskCount: m.user._count.assignedTasks,
      };
    }),
    eligibleTasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      estimate: t.estimate,
      dueDate: t.dueDate?.toISOString() ?? null,
      workPackageCode: t.workPackage?.code ?? null,
      workPackageName: t.workPackage?.name ?? null,
      assigneeNames: t.assignees.map((a) => a.name).join(", ") || "—",
    })),
  };
}

async function loadCapabilitiesSnippet(): Promise<string> {
  const article = await prisma.knowledgeArticle.findFirst({
    where: { title: LAB_CAPABILITIES_TITLE, projectId: null },
    orderBy: { updatedAt: "desc" },
    select: { content: true },
  });
  if (!article?.content?.trim()) return "";
  return article.content.trim().slice(0, 4000);
}

function buildPrompt(
  input: SprintPlannerInput,
  context: SprintPlannerContext,
  projectContext: string,
  capabilitiesSnippet: string,
): string {
  const team = context.members
    .filter((m) => input.teamMemberIds.includes(m.userId))
    .map(
      (m) =>
        `- [${m.userId}] ${m.name} (${m.role}, ${m.profilesLabel}) — ${m.openTaskCount} tarefas abertas no projeto`,
    )
    .join("\n");

  const taskLines = context.eligibleTasks
    .map((t) => {
      const wbs = t.workPackageCode
        ? ` WBS:${t.workPackageCode}`
        : t.workPackageName
          ? ` WBS:${t.workPackageName}`
          : "";
      const est = t.estimate != null ? ` | ${t.estimate}h` : "";
      const due = t.dueDate ? ` | prazo:${t.dueDate.slice(0, 10)}` : "";
      const assignees = t.assigneeNames !== "—" ? ` | resp:${t.assigneeNames}` : "";
      return `- [${t.id}] ${t.title} [${t.status}/${t.priority}]${wbs}${est}${due}${assignees}`;
    })
    .join("\n");

  const start = input.startDate ?? "";
  const end = input.endDate ?? "";

  return `Voce e um especialista em planejamento agil e gestao de laboratorio de pesquisa.

Planeje uma sprint para o projeto "${context.project.name}" (${context.project.key}).

PARAMETROS DA SPRINT:
- Nome sugerido: ${input.name}
- Duracao: ${input.durationWeeks} semana(s)
- Inicio: ${start || "(nao definido)"}
- Fim: ${end || "(nao definido)"}

EQUIPE SELECIONADA PARA A SPRINT:
${team || "(nenhum membro selecionado)"}

TAREFAS PENDENTES ELEGIVEIS (sem sprint, nao concluidas):
${taskLines || "(nenhuma tarefa pendente)"}

CONTEXTO DO PROJETO:
${projectContext}

${capabilitiesSnippet ? `MAPA DE CAPACIDADES DA EQUIPE (referencia interna):\n${capabilitiesSnippet}\n` : ""}

Retorne APENAS JSON valido (sem markdown):
{
  "version": "${ARTIFACTS_FORMAT_VERSION}",
  "sprint": {
    "name": "${input.name}",
    "goal": "meta objetiva da sprint em 1-2 frases",
    "startDate": "${start}",
    "endDate": "${end}",
    "durationWeeks": ${input.durationWeeks}
  },
  "teamMemberIds": ${JSON.stringify(input.teamMemberIds)},
  "suggestedTasks": [
    {
      "taskId": "id exato da lista de tarefas elegiveis",
      "rationale": "por que incluir nesta sprint",
      "suggestedAssigneeId": "id do membro da equipe selecionada (opcional)"
    }
  ],
  "capacityNotes": "observacoes sobre capacidade e riscos"
}

Regras:
- suggestedTasks deve usar APENAS taskId da lista de tarefas elegiveis — nao invente tarefas
- Priorize tarefas com prazo proximo, alta prioridade e alinhamento com a meta da sprint
- Considere a capacidade da equipe (${input.durationWeeks} semanas); nao sobrecarregue
- suggestedAssigneeId deve ser um dos teamMemberIds quando informado
- Se nao houver tarefas elegiveis, retorne suggestedTasks vazio e explique em capacityNotes
- Texto em portugues`;
}

function extractJson(text: string): SprintPlanDraft {
  const trimmed = text.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("IA nao retornou JSON valido");
  const parsed = JSON.parse(trimmed.slice(start, end + 1)) as SprintPlanDraft;
  if (!parsed.sprint?.name) throw new Error("Plano de sprint invalido: falta nome");
  if (!Array.isArray(parsed.suggestedTasks)) parsed.suggestedTasks = [];
  if (!Array.isArray(parsed.teamMemberIds)) parsed.teamMemberIds = [];
  return parsed;
}

function validatePlan(plan: SprintPlanDraft, context: SprintPlannerContext, input: SprintPlannerInput) {
  const validTaskIds = new Set(context.eligibleTasks.map((t) => t.id));
  const validMemberIds = new Set(input.teamMemberIds);

  plan.suggestedTasks = plan.suggestedTasks.filter((s) => {
    if (!validTaskIds.has(s.taskId)) return false;
    if (s.suggestedAssigneeId && !validMemberIds.has(s.suggestedAssigneeId)) {
      delete s.suggestedAssigneeId;
    }
    return true;
  });

  plan.teamMemberIds = input.teamMemberIds;
  plan.sprint.name = input.name;
  plan.sprint.durationWeeks = input.durationWeeks;
  if (input.startDate) plan.sprint.startDate = input.startDate;
  if (input.endDate) plan.sprint.endDate = input.endDate;
}

export async function suggestSprintPlanWithAi(input: SprintPlannerInput): Promise<SprintPlanDraft> {
  const [context, projectContext, capabilitiesSnippet] = await Promise.all([
    loadSprintPlannerContext(input.projectId),
    loadProjectContextForAi(input.projectId),
    loadCapabilitiesSnippet(),
  ]);

  if (context.eligibleTasks.length === 0) {
    return {
      version: ARTIFACTS_FORMAT_VERSION,
      sprint: {
        name: input.name,
        goal: "Sprint planejada — nenhuma tarefa pendente disponivel no backlog.",
        startDate: input.startDate ?? undefined,
        endDate: input.endDate ?? undefined,
        durationWeeks: input.durationWeeks,
      },
      teamMemberIds: input.teamMemberIds,
      suggestedTasks: [],
      capacityNotes: "Nao ha tarefas pendentes sem sprint para sugerir.",
    };
  }

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: "Voce retorna apenas JSON valido para planejamento de sprints em laboratorio de pesquisa.",
    },
    {
      role: "user",
      content: buildPrompt(input, context, projectContext, capabilitiesSnippet),
    },
  ];

  const raw = await chat(messages);
  const plan = extractJson(raw);
  validatePlan(plan, context, input);
  return plan;
}
