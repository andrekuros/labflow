export type PaletteId = "indigo" | "ocean" | "forest" | "sunset" | "rose" | "amber" | "slate" | "crimson";
export type ModeId = "light" | "dark";

export type Palette = {
  id: PaletteId;
  name: string;
  preview: string;
};

export const PALETTES: Palette[] = [
  { id: "indigo", name: "Indigo", preview: "#6366f1" },
  { id: "ocean", name: "Oceano", preview: "#06b6d4" },
  { id: "forest", name: "Floresta", preview: "#22c55e" },
  { id: "sunset", name: "Por do sol", preview: "#f97316" },
  { id: "rose", name: "Rose", preview: "#f472b6" },
  { id: "amber", name: "Ambar", preview: "#f59e0b" },
  { id: "slate", name: "Grafite", preview: "#64748b" },
  { id: "crimson", name: "Carmesim", preview: "#ef4444" },
];

export const DEFAULT_PALETTE: PaletteId = "indigo";
export const DEFAULT_MODE: ModeId = "dark";

export const PALETTE_STORAGE_KEY = "labflow-palette";
export const MODE_STORAGE_KEY = "labflow-mode";
/** @deprecated legacy single-key storage */
export const THEME_STORAGE_KEY = "labflow-theme";

const LEGACY_MAP: Record<string, { palette: PaletteId; mode: ModeId }> = {
  dark: { palette: "indigo", mode: "dark" },
  light: { palette: "indigo", mode: "light" },
  ocean: { palette: "ocean", mode: "dark" },
  forest: { palette: "forest", mode: "dark" },
  sunset: { palette: "sunset", mode: "dark" },
  rose: { palette: "rose", mode: "dark" },
};

export function isPaletteId(v: string): v is PaletteId {
  return PALETTES.some((p) => p.id === v);
}

export function isModeId(v: string): v is ModeId {
  return v === "light" || v === "dark";
}

export function getStoredPalette(): PaletteId {
  if (typeof window === "undefined") return DEFAULT_PALETTE;
  const stored = localStorage.getItem(PALETTE_STORAGE_KEY);
  if (stored && isPaletteId(stored)) return stored;
  const legacy = localStorage.getItem(THEME_STORAGE_KEY);
  if (legacy && LEGACY_MAP[legacy]) return LEGACY_MAP[legacy].palette;
  return DEFAULT_PALETTE;
}

export function getStoredMode(): ModeId {
  if (typeof window === "undefined") return DEFAULT_MODE;
  const stored = localStorage.getItem(MODE_STORAGE_KEY);
  if (stored && isModeId(stored)) return stored;
  const legacy = localStorage.getItem(THEME_STORAGE_KEY);
  if (legacy && LEGACY_MAP[legacy]) return LEGACY_MAP[legacy].mode;
  if (legacy === "light") return "light";
  return DEFAULT_MODE;
}

export function applyTheme(palette: PaletteId, mode: ModeId) {
  document.documentElement.setAttribute("data-palette", palette);
  document.documentElement.setAttribute("data-mode", mode);
  localStorage.setItem(PALETTE_STORAGE_KEY, palette);
  localStorage.setItem(MODE_STORAGE_KEY, mode);
  localStorage.removeItem(THEME_STORAGE_KEY);
}

export function applyStoredTheme() {
  applyTheme(getStoredPalette(), getStoredMode());
}

/** @deprecated use applyTheme(palette, mode) */
export type ThemeId = `${PaletteId}-${ModeId}`;
