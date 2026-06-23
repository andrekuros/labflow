import "server-only";
import { getPluginSettings } from "@/plugins/registry";
import { isMaskedApiKey } from "@/lib/ai/config";
import type { FolderProjectMap } from "@/plugins/knowledge/folder-map";

export type NextcloudSettings = {
  enabled: boolean;
  url: string;
  username: string;
  appPassword: string;
  folder: string;
  autoSyncEnabled: boolean;
  autoSyncIntervalMinutes: number;
  folderProjectMap: FolderProjectMap;
  excludeFolders: string[];
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  lastSyncMessage: string | null;
  lastSyncCount: number;
};

const MASK = "__MASKED__";
const DEFAULT_EXCLUDE = ["templates"];

export function maskNextcloudPassword(pw: string): string {
  return pw ? MASK : "";
}

export function isMaskedPassword(value: unknown): boolean {
  return value === MASK;
}

function parseFolderProjectMap(raw: unknown): FolderProjectMap {
  if (!raw || typeof raw !== "object") return {};
  const out: FolderProjectMap = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "string") out[k.replace(/^\/+|\/+$/g, "")] = v.trim();
  }
  return out;
}

function parseExcludeFolders(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  if (typeof raw === "string") {
    return raw.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [...DEFAULT_EXCLUDE];
}

export async function getNextcloudSettings(): Promise<NextcloudSettings> {
  const s = getPluginSettings("knowledge");
  return {
    enabled: Boolean(s.nextcloudEnabled),
    url: String(s.nextcloudUrl ?? ""),
    username: String(s.nextcloudUsername ?? ""),
    appPassword: String(s.nextcloudAppPassword ?? ""),
    folder: String(s.nextcloudFolder ?? "LabFlow"),
    autoSyncEnabled: Boolean(s.nextcloudAutoSyncEnabled ?? false),
    autoSyncIntervalMinutes: Number(s.nextcloudAutoSyncIntervalMinutes ?? 60),
    folderProjectMap: parseFolderProjectMap(s.nextcloudFolderProjectMap),
    excludeFolders: parseExcludeFolders(s.nextcloudExcludeFolders ?? DEFAULT_EXCLUDE),
    lastSyncAt: s.nextcloudLastSyncAt ? String(s.nextcloudLastSyncAt) : null,
    lastSyncStatus: s.nextcloudLastSyncStatus ? String(s.nextcloudLastSyncStatus) : null,
    lastSyncMessage: s.nextcloudLastSyncMessage ? String(s.nextcloudLastSyncMessage) : null,
    lastSyncCount: Number(s.nextcloudLastSyncCount ?? 0),
  };
}

export async function getNextcloudSettingsForUi() {
  const s = await getNextcloudSettings();
  return {
    ...s,
    appPassword: s.appPassword ? MASK : "",
    hasStoredPassword: Boolean(s.appPassword),
    folderProjectMapJson: JSON.stringify(s.folderProjectMap, null, 2),
    excludeFoldersText: s.excludeFolders.join(", "),
  };
}

export function mergeNextcloudPassword(
  input: string | undefined,
  current: string,
): string | undefined {
  if (!input || isMaskedApiKey(input) || isMaskedPassword(input)) {
    return current || undefined;
  }
  return input;
}

export function parseFolderProjectMapJson(json: string): FolderProjectMap {
  try {
    const parsed = JSON.parse(json) as unknown;
    return parseFolderProjectMap(parsed);
  } catch {
    return {};
  }
}
