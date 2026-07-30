import { labelForEvent } from "@/lib/activity-log/constants";

type Payload = Record<string, unknown>;

function parsePayload(raw: string): Payload {
  try {
    return JSON.parse(raw) as Payload;
  } catch {
    return {};
  }
}

function str(payload: Payload, key: string): string | null {
  const v = payload[key];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export function activityDetail(type: string, payloadRaw: string): string | null {
  const payload = parsePayload(payloadRaw);
  const title = str(payload, "title") ?? str(payload, "name");
  if (title) return title;

  if (type === "task.moved") {
    const from = str(payload, "from");
    const to = str(payload, "to");
    if (from && to) return `${from} → ${to}`;
  }

  if (type === "user.updated" && payload.deleted === true) return "Conta removida";
  if (type === "post.created" || type === "thread.created") {
    const content = str(payload, "content");
    if (content) return content.length > 80 ? `${content.slice(0, 80)}…` : content;
  }

  return null;
}

export function activityHref(
  type: string,
  targetId: string | null,
  projectId: string | null,
  payloadRaw: string,
): string | null {
  const payload = parsePayload(payloadRaw);
  const id = targetId ?? str(payload, "id");

  if (type.startsWith("task.") && projectId) return `/board?project=${projectId}`;
  if (type.startsWith("deliverable.") && projectId) return `/deliverables?project=${projectId}`;
  if (type.startsWith("requirement.") && projectId) return `/requirements?project=${projectId}`;
  if (type.startsWith("article.") && id) return `/knowledge/${id}`;
  if (type.startsWith("project.") && id) return `/projects/${id}`;
  if (type.startsWith("publication.")) return "/papers";
  if (type.startsWith("paper.") && id) return `/projects/${id}`;
  if (type === "thread.created" || type === "post.created") return "/forum";
  if (type.startsWith("user.") && id) return `/team/${id}`;
  if (type === "academic.updated") {
    return "/thesis";
  }
  if (type === "feedback.submitted") return "/feedback";

  return null;
}

export function formatActivityRow(row: {
  id: string;
  type: string;
  actorId: string | null;
  projectId: string | null;
  targetId: string | null;
  payload: string;
  createdAt: Date;
  actor?: { id: string; name: string; avatarColor: string } | null;
  project?: { id: string; key: string; name: string; color: string } | null;
}) {
  return {
    id: row.id,
    type: row.type,
    label: labelForEvent(row.type),
    detail: activityDetail(row.type, row.payload),
    href: activityHref(row.type, row.targetId, row.projectId, row.payload),
    actor: row.actor
      ? { id: row.actor.id, name: row.actor.name, avatarColor: row.actor.avatarColor }
      : null,
    project: row.project
      ? { id: row.project.id, key: row.project.key, name: row.project.name, color: row.project.color }
      : null,
    createdAt: row.createdAt.toISOString(),
  };
}

export type ActivityLogRow = ReturnType<typeof formatActivityRow>;
