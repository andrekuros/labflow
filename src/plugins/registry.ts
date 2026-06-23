import "server-only";
import { on } from "@/lib/events";
import { prisma } from "@/lib/db";
import type {
  AiTool,
  NavItem,
  PluginManifest,
  PluginRecord,
  UiSlot,
} from "@/plugins/types";

type RegistryState = {
  manifests: Map<string, PluginManifest>;
  plugins: PluginRecord[];
  aiTools: AiTool[];
  initialized: boolean;
};

const g = globalThis as unknown as { __labflowPlugins?: RegistryState };

function state(): RegistryState {
  if (!g.__labflowPlugins) {
    g.__labflowPlugins = {
      manifests: new Map(),
      plugins: [],
      aiTools: [],
      initialized: false,
    };
  }
  return g.__labflowPlugins;
}

function wireManifest(manifest: PluginManifest) {
  const s = state();
  for (const sub of manifest.subscriptions ?? []) {
    on(sub.event, sub.handler);
  }
  for (const tool of manifest.aiTools ?? []) {
    if (!s.aiTools.some((t) => t.name === tool.name)) {
      s.aiTools.push(tool);
    }
  }
}

export function registerPlugin(manifest: PluginManifest) {
  const s = state();
  if (s.manifests.has(manifest.id)) return;
  s.manifests.set(manifest.id, manifest);
  wireManifest(manifest);
}

function parseJson(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function mergeSettings(
  manifest: PluginManifest,
  stored: Record<string, unknown>,
): Record<string, unknown> {
  return { ...(manifest.defaultSettings ?? {}), ...stored };
}

function dependenciesMet(plugin: PluginRecord, enabledIds: Set<string>): boolean {
  const requires = plugin.manifest.requires ?? [];
  return requires.every((id) => enabledIds.has(id));
}

/** Sync plugin manifests with the database and build the runtime registry. */
export async function initPluginRegistry() {
  const s = state();
  if (s.initialized) return;

  const manifests = [...s.manifests.values()];
  for (const manifest of manifests) {
    await prisma.plugin.upsert({
      where: { pluginId: manifest.id },
      update: { name: manifest.name, version: manifest.version },
      create: {
        pluginId: manifest.id,
        name: manifest.name,
        version: manifest.version,
        order: manifest.nav?.order ?? 0,
        config: JSON.stringify(manifest.defaultSettings ?? {}),
      },
    });
  }

  const rows = await prisma.plugin.findMany({ orderBy: [{ order: "asc" }, { name: "asc" }] });
  const enabledIds = new Set(rows.filter((r) => r.enabled).map((r) => r.pluginId));

  s.plugins = rows
    .map((row) => {
      const manifest = s.manifests.get(row.pluginId);
      if (!manifest) return null;
      return {
        manifest,
        enabled: row.enabled,
        settings: mergeSettings(manifest, parseJson(row.config)),
        order: row.order,
      } satisfies PluginRecord;
    })
    .filter((p): p is PluginRecord => p !== null)
    .filter((p) => !p.enabled || dependenciesMet(p, enabledIds));

  s.initialized = true;
}

export async function ensurePluginRegistry() {
  await initPluginRegistry();
}

export function listPluginManifests(): PluginManifest[] {
  return [...state().manifests.values()];
}

export function listPlugins(): PluginRecord[] {
  return state().plugins;
}

export function listEnabledPlugins(): PluginRecord[] {
  return state().plugins.filter((p) => p.enabled);
}

export function getPlugin(id: string): PluginRecord | undefined {
  return state().plugins.find((p) => p.manifest.id === id);
}

export function getPluginSettings(id: string): Record<string, unknown> {
  return getPlugin(id)?.settings ?? {};
}

export function listAiTools(): AiTool[] {
  const enabledIds = new Set(listEnabledPlugins().map((p) => p.manifest.id));
  return state().aiTools.filter((tool) => {
    const owner = listPluginManifests().find((m) => m.aiTools?.some((t) => t.name === tool.name));
    return !owner || enabledIds.has(owner.id);
  });
}

export function uiForSlot(slot: UiSlot) {
  const enabledIds = new Set(listEnabledPlugins().map((p) => p.manifest.id));
  return [...state().manifests.values()]
    .filter((p) => enabledIds.has(p.id))
    .flatMap((p) => (p.ui ?? []).map((u) => ({ pluginId: p.id, ...u })))
    .filter((u) => u.slot === slot);
}

export async function getNavItems(): Promise<NavItem[]> {
  await ensurePluginRegistry();
  return listEnabledPlugins()
    .filter((p) => p.manifest.nav)
    .map((p) => ({
      pluginId: p.manifest.id,
      label: p.manifest.nav!.label,
      href: p.manifest.nav!.href,
      icon: p.manifest.nav!.icon,
      order: p.order || p.manifest.nav!.order,
      group: p.manifest.nav!.group ?? "Modulos",
    }))
    .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
}

export async function setPluginEnabled(pluginId: string, enabled: boolean) {
  const manifest = state().manifests.get(pluginId);
  if (!manifest) throw new Error("Plugin nao encontrado");

  const row = await prisma.plugin.findUnique({ where: { pluginId } });
  if (!row) throw new Error("Plugin nao instalado");

  const settings = mergeSettings(manifest, parseJson(row.config));

  if (enabled) {
    const requires = manifest.requires ?? [];
    for (const dep of requires) {
      const depRow = await prisma.plugin.findUnique({ where: { pluginId: dep } });
      if (!depRow?.enabled) {
        throw new Error(`Dependencia nao habilitada: ${dep}`);
      }
    }
    await manifest.lifecycle?.onEnable?.({ settings });
  } else {
    await manifest.lifecycle?.onDisable?.({ settings });
  }

  await prisma.plugin.update({ where: { pluginId }, data: { enabled } });
  state().initialized = false;
  await initPluginRegistry();
}

export async function setPluginSettings(pluginId: string, settings: Record<string, unknown>) {
  const manifest = state().manifests.get(pluginId);
  if (!manifest) throw new Error("Plugin nao encontrado");

  const row = await prisma.plugin.findUnique({ where: { pluginId } });
  if (!row) throw new Error("Plugin nao instalado");

  const previous = mergeSettings(manifest, parseJson(row.config));
  const next = mergeSettings(manifest, settings);

  await prisma.plugin.update({
    where: { pluginId },
    data: { config: JSON.stringify(next) },
  });

  await manifest.lifecycle?.onSettingsChange?.({ settings: next, previous });
  state().initialized = false;
  await initPluginRegistry();
}

export async function setPluginProjectSettings(
  pluginId: string,
  projectId: string,
  settings: Record<string, unknown>,
) {
  await prisma.pluginProjectSettings.upsert({
    where: { pluginId_projectId: { pluginId, projectId } },
    update: { settings: JSON.stringify(settings) },
    create: { pluginId, projectId, settings: JSON.stringify(settings) },
  });
}

export async function getPluginProjectSettings(
  pluginId: string,
  projectId: string,
): Promise<Record<string, unknown>> {
  const row = await prisma.pluginProjectSettings.findUnique({
    where: { pluginId_projectId: { pluginId, projectId } },
  });
  if (!row) return {};
  return parseJson(row.settings);
}

export function getPluginApiHandler(
  pluginId: string,
  method: string,
  subPath: string,
): import("@/plugins/types").PluginApiHandler | null {
  const mod = state().manifests.get(pluginId);
  if (!mod?.apiPrefix) return null;

  // Dynamic import handled by plugin api modules via registry map
  return apiHandlerMap.get(`${pluginId}:${method}:${subPath}`) ?? null;
}

const apiHandlerMap = new Map<string, import("@/plugins/types").PluginApiHandler>();

export function registerApiHandlers(pluginId: string, handlers: import("@/plugins/types").PluginApiHandlers) {
  for (const [route, handler] of Object.entries(handlers)) {
    const [method, ...pathParts] = route.split(" ");
    const path = pathParts.join(" ").trim();
    apiHandlerMap.set(`${pluginId}:${method}:${path}`, handler);
  }
}

export function matchApiHandler(
  pluginId: string,
  method: string,
  subPath: string,
): { handler: import("@/plugins/types").PluginApiHandler; params: Record<string, string> } | null {
  const exact = apiHandlerMap.get(`${pluginId}:${method}:${subPath}`);
  if (exact) return { handler: exact, params: {} };

  for (const [key, handler] of apiHandlerMap.entries()) {
    const [pid, m, pattern] = key.split(":");
    if (pid !== pluginId || m !== method) continue;

    const paramNames: string[] = [];
    const regex = new RegExp(
      "^" +
        pattern.replace(/:[^/]+/g, (match) => {
          paramNames.push(match.slice(1));
          return "([^/]+)";
        }) +
        "$",
    );
    const result = subPath.match(regex);
    if (!result) continue;

    const params: Record<string, string> = {};
    paramNames.forEach((name, i) => {
      params[name] = result[i + 1];
    });
    return { handler, params };
  }

  return null;
}
