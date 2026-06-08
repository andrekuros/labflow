import type { ComponentType } from "react";
import type { DomainEvent, DomainEventType } from "@/lib/events";

/** Named regions of the UI that plugins can extend. */
export type UiSlot =
  | "dashboard.widgets"
  | "sidebar.nav"
  | "project.tabs"
  | "task.panel";

export type AiTool = {
  name: string;
  description: string;
  /** JSON-schema-like parameter description (kept simple/portable). */
  parameters: Record<string, { type: string; description?: string }>;
  run: (args: Record<string, unknown>, ctx: { userId?: string }) => Promise<string>;
};

export type PluginEventSubscription = {
  event: DomainEventType | "*";
  handler: (event: DomainEvent) => void | Promise<void>;
};

export type PluginUiContribution = {
  slot: UiSlot;
  component: ComponentType<Record<string, unknown>>;
};

/** A plugin manifest: the single contract every plugin implements. */
export type PluginManifest = {
  id: string;
  name: string;
  version: string;
  description?: string;
  /** Server-side domain event subscribers. */
  subscriptions?: PluginEventSubscription[];
  /** Tools exposed to AI agents. */
  aiTools?: AiTool[];
  /** Frontend contributions rendered into UI slots. */
  ui?: PluginUiContribution[];
};
