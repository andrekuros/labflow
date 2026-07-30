import type { DomainEventType } from "@/lib/events";

export const EVENT_LABELS: Record<string, string> = {
  "task.created": "Tarefa criada",
  "task.updated": "Tarefa atualizada",
  "task.moved": "Tarefa movida no Kanban",
  "deliverable.created": "Entregavel criado",
  "deliverable.updated": "Entregavel atualizado",
  "requirement.created": "Requisito criado",
  "article.created": "Artigo criado",
  "article.updated": "Artigo atualizado",
  "article.deleted": "Artigo excluido",
  "thread.created": "Topico no forum",
  "post.created": "Mensagem no forum",
  "project.created": "Projeto criado",
  "project.updated": "Projeto atualizado",
  "user.created": "Usuario criado",
  "user.updated": "Usuario atualizado",
  "academic.updated": "Perfil academico atualizado",
  "publication.created": "Publicacao criada",
  "publication.updated": "Publicacao atualizada",
  "feedback.submitted": "Feedback enviado",
  "sprint.created": "Sprint criada",
  "report.weekly_sent": "Relatorio semanal enviado",
};

export const EVENT_TYPES = Object.keys(EVENT_LABELS) as DomainEventType[];

export const EVENT_GROUPS: { label: string; types: DomainEventType[] }[] = [
  {
    label: "Tarefas",
    types: ["task.created", "task.updated", "task.moved"],
  },
  {
    label: "Projetos",
    types: ["project.created", "project.updated"],
  },
  {
    label: "Requisitos e entregaveis",
    types: ["requirement.created", "deliverable.created", "deliverable.updated"],
  },
  {
    label: "Conhecimento",
    types: ["article.created", "article.updated", "article.deleted"],
  },
  {
    label: "Forum",
    types: ["thread.created", "post.created"],
  },
  {
    label: "Equipe",
    types: ["user.created", "user.updated", "academic.updated"],
  },
  {
    label: "Publicacoes",
    types: ["publication.created", "publication.updated"],
  },
  {
    label: "Outros",
    types: ["feedback.submitted", "sprint.created", "report.weekly_sent"],
  },
];

export function labelForEvent(type: string): string {
  return EVENT_LABELS[type] ?? type;
}
