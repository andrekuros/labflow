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
  adminOnlyFolders: string[];
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  lastSyncMessage: string | null;
  lastSyncCount: number;
};

const MASK = "__MASKED__";
const DEFAULT_EXCLUDE = ["templates"];
const DEFAULT_ADMIN_ONLY = ["admin"];

function parseFolderList(raw: unknown, fallback: string[]): string[] {
  if (Array.isArray(raw)) return raw.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof raw === "string") {
    const parsed = raw.split(",").map((s) => s.trim()).filter(Boolean);
    return parsed.length > 0 ? parsed : fallback;
  }
  return [...fallback];
}

function parseExcludeFolders(raw: unknown): string[] {
  return parseFolderList(raw, DEFAULT_EXCLUDE);
}

function parseAdminOnlyFolders(raw: unknown): string[] {
  return parseFolderList(raw, DEFAULT_ADMIN_ONLY);
}

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
    adminOnlyFolders: parseAdminOnlyFolders(s.nextcloudAdminOnlyFolders ?? DEFAULT_ADMIN_ONLY),
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
    adminOnlyFoldersText: s.adminOnlyFolders.join(", "),
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

/** Build a browser URL to open a synced file in Nextcloud Files. */
export function buildNextcloudFileUrl(
  cfg: Pick<NextcloudSettings, "url" | "username" | "folder">,
  externalPath: string,
): string | null {
  const base = cfg.url.replace(/\/+$/, "");
  if (!base || !externalPath) return null;

  const dir = externalPath.includes("/")
    ? externalPath.slice(0, externalPath.lastIndexOf("/"))
    : cfg.folder;

  const dirParam = encodeURIComponent(`/${dir.replace(/^\/+/, "")}`);
  return `${base}/apps/files/?dir=${dirParam}`;
}
