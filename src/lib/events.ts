import "server-only";
import { prisma } from "@/lib/db";

/**
 * Domain event bus (in-process pub/sub).
 *
 * This is the low-coupling backbone of the platform: core modules emit events,
 * and subscribers (activity log, knowledge/RAG ingestion, plugins, AI agents)
 * react without the core knowing about them. Swap for BullMQ/Redis later by
 * replacing the `emit` transport while keeping the same event contracts.
 */

export type DomainEventType =
  | "task.created"
  | "task.updated"
  | "task.moved"
  | "deliverable.created"
  | "deliverable.updated"
  | "requirement.created"
  | "article.created"
  | "article.updated"
  | "article.deleted"
  | "thread.created"
  | "post.created"
  | "project.created"
  | "project.updated"
  | "user.created"
  | "user.updated"
  | "academic.updated"
  | "feedback.submitted";

export type DomainEvent = {
  type: DomainEventType;
  actorId?: string | null;
  projectId?: string | null;
  targetId?: string | null;
  payload?: Record<string, unknown>;
};

export type EventHandler = (event: DomainEvent) => void | Promise<void>;

type Bus = {
  handlers: Map<string, EventHandler[]>;
};

const globalForBus = globalThis as unknown as { __labflowBus?: Bus };

function bus(): Bus {
  if (!globalForBus.__labflowBus) {
    globalForBus.__labflowBus = { handlers: new Map() };
  }
  return globalForBus.__labflowBus;
}

/** Subscribe to an event type, or "*" for all events. */
export function on(type: DomainEventType | "*", handler: EventHandler) {
  const b = bus();
  const list = b.handlers.get(type) ?? [];
  list.push(handler);
  b.handlers.set(type, list);
}

/** Emit an event: persists to the activity log and notifies subscribers. */
export async function emit(event: DomainEvent) {
  try {
    await prisma.activityLog.create({
      data: {
        type: event.type,
        actorId: event.actorId ?? null,
        projectId: event.projectId ?? null,
        targetId: event.targetId ?? null,
        payload: JSON.stringify(event.payload ?? {}),
      },
    });
  } catch {
    // activity log is best-effort
  }

  const b = bus();
  const handlers = [...(b.handlers.get(event.type) ?? []), ...(b.handlers.get("*") ?? [])];
  await Promise.all(
    handlers.map(async (h) => {
      try {
        await h(event);
      } catch (err) {
        console.error(`[events] handler failed for ${event.type}`, err);
      }
    }),
  );
}
