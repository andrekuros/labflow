import "server-only";
import { on } from "@/lib/events";
import type { AiTool, PluginManifest, UiSlot } from "@/plugins/types";

/**
 * Plugin host / registry.
 *
 * Plugins declare a manifest; registering one wires its event subscribers and
 * AI tools, and records its UI contributions so the frontend can render them
 * into named slots. New features can be added without touching the core.
 */

type RegistryState = {
  plugins: PluginManifest[];
  aiTools: AiTool[];
  initialized: boolean;
};

const g = globalThis as unknown as { __labflowPlugins?: RegistryState };

function state(): RegistryState {
  if (!g.__labflowPlugins) {
    g.__labflowPlugins = { plugins: [], aiTools: [], initialized: false };
  }
  return g.__labflowPlugins;
}

export function registerPlugin(manifest: PluginManifest) {
  const s = state();
  if (s.plugins.some((p) => p.id === manifest.id)) return;
  s.plugins.push(manifest);

  for (const sub of manifest.subscriptions ?? []) {
    on(sub.event, sub.handler);
  }
  for (const tool of manifest.aiTools ?? []) {
    s.aiTools.push(tool);
  }
}

export function listPlugins(): PluginManifest[] {
  return state().plugins;
}

export function listAiTools(): AiTool[] {
  return state().aiTools;
}

/** UI contributions for a given slot (manifest + component pairs). */
export function uiForSlot(slot: UiSlot) {
  return state()
    .plugins.flatMap((p) => (p.ui ?? []).map((u) => ({ pluginId: p.id, ...u })))
    .filter((u) => u.slot === slot);
}
