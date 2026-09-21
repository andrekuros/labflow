import type { ComponentType } from "react";
import type { NextRequest } from "next/server";
import type { DomainEvent, DomainEventType } from "@/lib/events";
import type { SessionUser } from "@/lib/auth";

/** Named regions of the UI that plugins can extend. */
export type UiSlot =
  | "dashboard.widgets"
  | "sidebar.nav"
  | "project.tabs"
  | "task.panel";

export type SettingsFieldType = "text" | "number" | "boolean" | "select" | "json" | "secret";

export type SettingsField = {
  key: string;
  label: string;
  type: SettingsFieldType;
  options?: { value: string; label: string }[];
  description?: string;
  defaultValue?: unknown;
};

export type PluginNav = {
  label: string;
  href: string;
  icon: string;
  order: number;
  group?: string;
};

export type AiToolContext = {
  userId?: string;
  /** Resolved session of the user who asked. Use it for RBAC inside `run`. */
  user?: SessionUser | null;
};

/**
 * A function the assistant can call.
 *
 * `kind` is the safety contract:
 *  - "read"    — answers a question; executed immediately.
 *  - "propose" — must create an `AiDraft` for a human to accept. Never mutate
 *                domain data directly from a tool: the platform's rule is that
 *                AI proposes and a person decides.
 *
 * `run` is responsible for its own authorization. The assistant refuses to
 * execute a tool at all when there is no authenticated user.
 */
export type AiTool = {
  name: string;
  description: string;
  parameters: Record<string, { type: string; description?: string }>;
  /** Parameter names the model must always supply. */
  required?: string[];
  kind?: "read" | "propose";
  run: (args: Record<string, unknown>, ctx: AiToolContext) => Promise<string>;
};

export type PluginEventSubscription = {
  event: DomainEventType | "*";
  handler: (event: DomainEvent) => void | Promise<void>;
};

export type PluginUiContribution = {
  slot: UiSlot;
  component: ComponentType<Record<string, unknown>>;
};

export type PluginApiContext = {
  user: SessionUser;
  params: Record<string, string>;
  request: NextRequest;
};

export type PluginApiHandler = (
  ctx: PluginApiContext,
  body?: unknown,
) => Promise<Response> | Response;

export type PluginApiHandlers = Record<string, PluginApiHandler>;

export type PluginLifecycleContext = {
  settings: Record<string, unknown>;
};

export type PluginLifecycleHooks = {
  /** Called once after registry init when the plugin is already enabled (server boot / redeploy). */
  onBoot?: (ctx: PluginLifecycleContext) => void | Promise<void>;
  onEnable?: (ctx: PluginLifecycleContext) => void | Promise<void>;
  onDisable?: (ctx: PluginLifecycleContext) => void | Promise<void>;
  onSettingsChange?: (
    ctx: PluginLifecycleContext & { previous: Record<string, unknown> },
  ) => void | Promise<void>;
};

/** A plugin manifest: the single contract every plugin implements. */
export type PluginManifest = {
  id: string;
  name: string;
  version: string;
  description?: string;
  icon?: string;
  /** Plugin ids that must be enabled before this one. */
  requires?: string[];
  nav?: PluginNav;
  settingsSchema?: SettingsField[];
  defaultSettings?: Record<string, unknown>;
  apiPrefix?: string;
  subscriptions?: PluginEventSubscription[];
  aiTools?: AiTool[];
  ui?: PluginUiContribution[];
  lifecycle?: PluginLifecycleHooks;
};

export type PluginRecord = {
  manifest: PluginManifest;
  enabled: boolean;
  settings: Record<string, unknown>;
  order: number;
};

export type NavItem = {
  pluginId: string;
  label: string;
  href: string;
  icon: string;
  order: number;
  group: string;
};
