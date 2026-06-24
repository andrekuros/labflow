export type UserPreferences = {
  navHidden?: string[];
  sidebarCollapsed?: boolean;
};

export const DEFAULT_PREFERENCES: UserPreferences = {
  navHidden: [],
  sidebarCollapsed: false,
};

export function parsePreferences(raw: string | null | undefined): UserPreferences {
  if (!raw) return { ...DEFAULT_PREFERENCES };
  try {
    const parsed = JSON.parse(raw) as UserPreferences;
    return {
      navHidden: Array.isArray(parsed.navHidden) ? parsed.navHidden : [],
      sidebarCollapsed: Boolean(parsed.sidebarCollapsed),
    };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export function serializePreferences(prefs: UserPreferences): string {
  return JSON.stringify({
    navHidden: prefs.navHidden ?? [],
    sidebarCollapsed: Boolean(prefs.sidebarCollapsed),
  });
}
