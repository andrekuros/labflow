import type { WorkspacePrefs } from "@/lib/workspace-prefs";
import { DEFAULT_WORKSPACE, parseWorkspace } from "@/lib/workspace-prefs";
import { parseSavedBoardViews, type SavedBoardView } from "@/lib/board-view";

export type UserPreferences = {
  navHidden?: string[];
  sidebarCollapsed?: boolean;
  workspace?: WorkspacePrefs;
  boardViews?: SavedBoardView[];
  /** Saved board view (modelo) applied by default when opening /board. */
  preferredBoardViewId?: string | null;
};

export const DEFAULT_PREFERENCES: UserPreferences = {
  navHidden: [],
  sidebarCollapsed: false,
  workspace: { ...DEFAULT_WORKSPACE },
  boardViews: [],
  preferredBoardViewId: null,
};

export function parsePreferences(raw: string | null | undefined): UserPreferences {
  if (!raw) {
    return {
      ...DEFAULT_PREFERENCES,
      workspace: { ...DEFAULT_WORKSPACE },
      boardViews: [],
      preferredBoardViewId: null,
    };
  }
  try {
    const parsed = JSON.parse(raw) as UserPreferences;
    const boardViews = parseSavedBoardViews(parsed.boardViews);
    const preferredRaw =
      typeof parsed.preferredBoardViewId === "string" ? parsed.preferredBoardViewId : null;
    const preferredBoardViewId =
      preferredRaw && boardViews.some((v) => v.id === preferredRaw) ? preferredRaw : null;
    return {
      navHidden: Array.isArray(parsed.navHidden) ? parsed.navHidden : [],
      sidebarCollapsed: Boolean(parsed.sidebarCollapsed),
      workspace: parseWorkspace(parsed.workspace),
      boardViews,
      preferredBoardViewId,
    };
  } catch {
    return {
      ...DEFAULT_PREFERENCES,
      workspace: { ...DEFAULT_WORKSPACE },
      boardViews: [],
      preferredBoardViewId: null,
    };
  }
}

export function serializePreferences(prefs: UserPreferences): string {
  const ws = parseWorkspace(prefs.workspace);
  const boardViews = parseSavedBoardViews(prefs.boardViews);
  const preferredRaw =
    typeof prefs.preferredBoardViewId === "string" ? prefs.preferredBoardViewId : null;
  const preferredBoardViewId =
    preferredRaw && boardViews.some((v) => v.id === preferredRaw) ? preferredRaw : null;
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
    boardViews,
    preferredBoardViewId,
  });
}
