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

export type AiTool = {
  name: string;
  description: string;
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
