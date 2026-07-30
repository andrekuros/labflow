import type { WorkspacePrefs } from "@/lib/workspace-prefs";
import { DEFAULT_WORKSPACE, parseWorkspace } from "@/lib/workspace-prefs";
import { parseSavedBoardViews, type SavedBoardView } from "@/lib/board-view";

export type UserPreferences = {
  navHidden?: string[];
  sidebarCollapsed?: boolean;
  workspace?: WorkspacePrefs;
  boardViews?: SavedBoardView[];
};

export const DEFAULT_PREFERENCES: UserPreferences = {
  navHidden: [],
  sidebarCollapsed: false,
  workspace: { ...DEFAULT_WORKSPACE },
  boardViews: [],
};

export function parsePreferences(raw: string | null | undefined): UserPreferences {
  if (!raw) return { ...DEFAULT_PREFERENCES, workspace: { ...DEFAULT_WORKSPACE }, boardViews: [] };
  try {
    const parsed = JSON.parse(raw) as UserPreferences;
    return {
      navHidden: Array.isArray(parsed.navHidden) ? parsed.navHidden : [],
      sidebarCollapsed: Boolean(parsed.sidebarCollapsed),
      workspace: parseWorkspace(parsed.workspace),
      boardViews: parseSavedBoardViews(parsed.boardViews),
    };
  } catch {
    return { ...DEFAULT_PREFERENCES, workspace: { ...DEFAULT_WORKSPACE }, boardViews: [] };
  }
}

export function serializePreferences(prefs: UserPreferences): string {
  const ws = parseWorkspace(prefs.workspace);
  return JSON.stringify({
    navHidden: prefs.navHidden ?? [],
    sidebarCollapsed: Boolean(prefs.sidebarCollapsed),
    workspace: {
      mode: ws.mode,
      projectId: ws.projectId ?? null,
      includeKinds: ws.includeKinds,
      kindToggles: ws.kindToggles,
      onlyMine: Boolean(ws.onlyMine),
    },
    boardViews: parseSavedBoardViews(prefs.boardViews),
  });
}
