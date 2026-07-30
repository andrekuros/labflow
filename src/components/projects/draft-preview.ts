import type { ArtifactType } from "@/lib/artifacts/schema";

export type DraftPreviewField = {
  label: string;
  value: string;
  tone?: "default" | "muted" | "badge" | "block";
  color?: string;
};

export type DraftPreview = {
  headline: string;
  summary?: string;
  fields: DraftPreviewField[];
};

const PRIORITY_LABELS: Record<string, { label: string; color: string }> = {
  low: { label: "Baixa", color: "#64748b" },
  medium: { label: "Media", color: "#3b82f6" },
  high: { label: "Alta", color: "#f59e0b" },
  urgent: { label: "Urgente", color: "#ef4444" },
};

const TASK_STATUS: Record<string, string> = {
  backlog: "Backlog",
  todo: "A fazer",
  in_progress: "Em andamento",
  review: "Revisao",
  done: "Concluida",
};

const REQ_LEVEL: Record<string, string> = {
  stakeholder: "Stakeholder",
  system: "Sistema",
  subsystem: "Subsistema",
  component: "Componente",
};

function str(v: unknown): string | null {
  if (v == null || v === "") return null;
  return String(v).trim();
}

function badgeField(label: string, value: string, color?: string): DraftPreviewField {
  return { label, value, tone: "badge", color };
}

export function parseDraftPayload(artifactType: string, payload: string, fallbackTitle: string): DraftPreview {
  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(payload) as Record<string, unknown>;
  } catch {
    return { headline: fallbackTitle, summary: payload, fields: [] };
  }

  switch (artifactType as ArtifactType) {
    case "task": {
      const title = str(data.title) ?? fallbackTitle;
      const desc = str(data.description);
      const priority = str(data.priority);
      const status = str(data.status);
      const wpCode = str(data.workPackageCode);
      const estimate = data.estimate;
      const rationale = str(data.rationale);
      const taskId = str(data.taskId);
      const fields: DraftPreviewField[] = [];
      if (taskId) fields.push(badgeField("Atualizacao", "Tarefa existente", "#6366f1"));
      if (wpCode) fields.push(badgeField("Pacote WBS", wpCode, "#8b5cf6"));
      if (estimate != null && estimate !== "") fields.push(badgeField("Estimativa", `${estimate}h`, "#22c55e"));
      if (priority && PRIORITY_LABELS[priority]) {
        const p = PRIORITY_LABELS[priority];
        fields.push(badgeField("Prioridade", p.label, p.color));
      } else if (priority) {
        fields.push(badgeField("Prioridade", priority));
      }
      if (status) fields.push(badgeField("Status inicial", TASK_STATUS[status] ?? status, "#6366f1"));
      if (rationale) fields.push({ label: "Justificativa IA", value: rationale, tone: "block" });
      return { headline: title, summary: desc ?? undefined, fields };
    }
    case "requirement": {
      const title = str(data.title) ?? fallbackTitle;
      const code = str(data.code);
      const desc = str(data.description);
      const fields: DraftPreviewField[] = [];
      if (code) fields.push(badgeField("Codigo", code, "#6366f1"));
      const level = str(data.level);
      if (level) fields.push(badgeField("Nivel", REQ_LEVEL[level] ?? level));
      const kind = str(data.kind);
      if (kind) fields.push(badgeField("Tipo", kind));
      const priority = str(data.priority);
      if (priority && PRIORITY_LABELS[priority]) {
        fields.push(badgeField("Prioridade", PRIORITY_LABELS[priority].label, PRIORITY_LABELS[priority].color));
      }
      return { headline: title, summary: desc ?? undefined, fields };
    }
    case "deliverable": {
      const name = str(data.name) ?? str(data.title) ?? fallbackTitle;
      const desc = str(data.description);
      const acceptance = str(data.acceptance);
      const due = str(data.dueDate);
      const fields: DraftPreviewField[] = [];
      if (acceptance) fields.push({ label: "Aceitacao", value: acceptance, tone: "block" });
      if (due) fields.push(badgeField("Prazo", due));
      const status = str(data.status);
      if (status) fields.push(badgeField("Status", status));
      return { headline: name, summary: desc ?? undefined, fields };
    }
    case "work_package": {
      const name = str(data.name) ?? fallbackTitle;
      const code = str(data.code);
      const desc = str(data.description);
      const fields: DraftPreviewField[] = [];
      if (code) fields.push(badgeField("Codigo WBS", code, "#8b5cf6"));
      const status = str(data.status);
      if (status) fields.push(badgeField("Status", status));
      return { headline: name, summary: desc ?? undefined, fields };
    }
    case "milestone": {
      const name = str(data.name) ?? fallbackTitle;
      const desc = str(data.description);
      const fields: DraftPreviewField[] = [];
      const gate = str(data.gate);
      if (gate) fields.push(badgeField("Gate", gate, "#6366f1"));
      const date = str(data.date);
      if (date) fields.push(badgeField("Data", date));
      const kind = str(data.kind);
      if (kind) fields.push(badgeField("Tipo", kind));
      return { headline: name, summary: desc ?? undefined, fields };
    }
    case "system_element": {
      const name = str(data.name) ?? fallbackTitle;
      const desc = str(data.description);
      const kind = str(data.kind);
      const fields: DraftPreviewField[] = [];
      if (kind) fields.push(badgeField("Elemento", kind));
      return { headline: name, summary: desc ?? undefined, fields };
    }
    case "verification_case": {
      const name = str(data.name) ?? fallbackTitle;
      const method = str(data.method);
      const reqCode = str(data.requirementCode);
      const fields: DraftPreviewField[] = [];
      if (method) fields.push(badgeField("Metodo", method));
      if (reqCode) fields.push(badgeField("Requisito", reqCode));
      const result = str(data.result);
      if (result) fields.push({ label: "Resultado esperado", value: result });
      return { headline: name, fields };
    }
    case "sprint_plan": {
      const sprint = data.sprint as {
        name?: string;
        goal?: string;
        startDate?: string;
        endDate?: string;
        durationWeeks?: number;
      };
      const suggested = (data.suggestedTasks ?? []) as { taskId: string; rationale?: string }[];
      const capacityNotes = str(data.capacityNotes);
      const name = sprint?.name ?? fallbackTitle;
      const fields: DraftPreviewField[] = [];
      if (sprint?.durationWeeks) fields.push(badgeField("Duracao", `${sprint.durationWeeks} semana(s)`, "#6366f1"));
      if (sprint?.startDate || sprint?.endDate) {
        const period = `${sprint.startDate?.slice(0, 10) ?? "?"} — ${sprint.endDate?.slice(0, 10) ?? "?"}`;
        fields.push(badgeField("Periodo", period, "#64748b"));
      }
      fields.push(badgeField("Tarefas sugeridas", String(suggested.length), "#22c55e"));
      const taskLines = suggested
        .map((t, i) => `${i + 1}. [${t.taskId}] ${t.rationale ?? ""}`)
        .join("\n");
      return {
        headline: name,
        summary: sprint?.goal ?? undefined,
        fields: [
          ...fields,
          ...(capacityNotes ? [{ label: "Capacidade", value: capacityNotes, tone: "block" as const }] : []),
          ...(taskLines
            ? [{ label: "Tarefas (edite o JSON para remover taskId)", value: taskLines, tone: "block" as const }]
            : []),
        ],
      };
    }
    default:
      return { headline: fallbackTitle, fields: [] };
  }
}

export const TYPE_META: Record<string, { label: string; color: string; icon: string }> = {
  task: { label: "Tarefas", color: "#3b82f6", icon: "task" },
  requirement: { label: "Requisitos", color: "#6366f1", icon: "requirement" },
  deliverable: { label: "Entregaveis", color: "#22c55e", icon: "deliverable" },
  work_package: { label: "Atividades WBS", color: "#8b5cf6", icon: "work_package" },
  milestone: { label: "Marcos", color: "#f59e0b", icon: "milestone" },
  system_element: { label: "Elementos", color: "#06b6d4", icon: "system_element" },
  verification_case: { label: "V&V", color: "#ec4899", icon: "verification_case" },
  sprint_plan: { label: "Plano de sprint", color: "#0ea5e9", icon: "sprint_plan" },
};
