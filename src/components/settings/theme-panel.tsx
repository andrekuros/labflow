"use client";

import { useEffect, useState } from "react";
import { Check, Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui";
import {
  PALETTES,
  applyTheme,
  getStoredMode,
  getStoredPalette,
  type ModeId,
  type PaletteId,
} from "@/lib/themes";

export function ThemePanel() {
  const [palette, setPalette] = useState<PaletteId>("indigo");
  const [mode, setMode] = useState<ModeId>("dark");

  useEffect(() => {
    setPalette(getStoredPalette());
    setMode(getStoredMode());
  }, []);

  function selectPalette(id: PaletteId) {
    applyTheme(id, mode);
    setPalette(id);
  }

  function toggleMode() {
    const next: ModeId = mode === "dark" ? "light" : "dark";
    applyTheme(palette, next);
    setMode(next);
  }

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Tema e aparência</h2>
          <p className="text-xs text-muted">Paleta de cores e modo claro/escuro.</p>
        </div>
        <button
          type="button"
          onClick={toggleMode}
          className="flex items-center gap-2 rounded-lg border border-border bg-surface2 px-3 py-2 text-sm transition hover:border-brand/50"
        >
          {mode === "dark" ? <Moon size={16} /> : <Sun size={16} />}
          {mode === "dark" ? "Modo escuro" : "Modo claro"}
        </button>
      </div>

      <p className="mb-2 text-xs font-medium text-muted">Paleta de cores</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {PALETTES.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => selectPalette(p.id)}
            className={cn(
              "flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm transition hover:bg-surface2",
              palette === p.id && "border-brand bg-brand/10",
            )}
          >
            <span
              className="h-5 w-5 shrink-0 rounded-full border border-border"
              style={{ backgroundColor: p.preview }}
            />
            <span className="flex-1 truncate text-left text-xs">{p.name}</span>
            {palette === p.id && <Check size={14} className="shrink-0 text-brand" />}
          </button>
        ))}
      </div>
    </Card>
  );
}
