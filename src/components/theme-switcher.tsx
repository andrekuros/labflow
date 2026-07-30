"use client";

import { useEffect, useState } from "react";
import { Check, Moon, Palette, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PALETTES,
  applyTheme,
  getStoredMode,
  getStoredPalette,
  type ModeId,
  type PaletteId,
} from "@/lib/themes";

/** Compact theme/mode controls for the app top bar. */
export function ThemeSwitcher() {
  const [palette, setPalette] = useState<PaletteId>("indigo");
  const [mode, setMode] = useState<ModeId>("dark");
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setPalette(getStoredPalette());
    setMode(getStoredMode());
    setReady(true);
  }, []);

  function toggleMode() {
    const next: ModeId = mode === "dark" ? "light" : "dark";
    applyTheme(palette, next);
    setMode(next);
  }

  function selectPalette(id: PaletteId) {
    applyTheme(id, mode);
    setPalette(id);
    setOpen(false);
  }

  const current = PALETTES.find((p) => p.id === palette) ?? PALETTES[0];

  return (
    <div className="flex items-center gap-0.5">
      <button
        type="button"
        onClick={toggleMode}
        disabled={!ready}
        title={mode === "dark" ? "Modo escuro — clicar para claro" : "Modo claro — clicar para escuro"}
        aria-label={mode === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition hover:bg-surface2 hover:text-fg"
      >
        {mode === "dark" ? <Moon size={17} /> : <Sun size={17} />}
      </button>

      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          disabled={!ready}
          title={`Paleta: ${current.name}`}
          aria-label="Escolher paleta de cores"
          aria-expanded={open}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-lg text-muted transition hover:bg-surface2 hover:text-fg",
            open && "bg-surface2 text-fg",
          )}
        >
          <span
            className="flex h-4 w-4 items-center justify-center rounded-full border border-border"
            style={{ backgroundColor: current.preview }}
          >
            <Palette size={10} className="text-white drop-shadow" />
          </span>
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-xl border border-border bg-surface p-2 shadow-xl">
              <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted">
                Paleta
              </p>
              <div className="grid grid-cols-1 gap-0.5">
                {PALETTES.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => selectPalette(p.id)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition hover:bg-surface2",
                      palette === p.id && "bg-brand/10",
                    )}
                  >
                    <span
                      className="h-4 w-4 shrink-0 rounded-full border border-border"
                      style={{ backgroundColor: p.preview }}
                    />
                    <span className="flex-1 truncate text-left text-xs">{p.name}</span>
                    {palette === p.id && <Check size={12} className="text-brand" />}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
