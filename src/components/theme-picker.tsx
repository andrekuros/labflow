"use client";

import { useEffect, useRef, useState } from "react";
import { Palette, Check, Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PALETTES,
  applyTheme,
  getStoredMode,
  getStoredPalette,
  type ModeId,
  type PaletteId,
} from "@/lib/themes";

export function ThemePicker() {
  const [palette, setPalette] = useState<PaletteId>("indigo");
  const [mode, setMode] = useState<ModeId>("dark");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPalette(getStoredPalette());
    setMode(getStoredMode());
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
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

  const current = PALETTES.find((p) => p.id === palette);

  return (
    <div ref={ref} className="relative border-b border-border px-3 py-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-muted transition hover:bg-surface2 hover:text-fg"
      >
        <Palette size={16} />
        <span className="flex-1 text-left">Tema</span>
        {mode === "dark" ? <Moon size={14} /> : <Sun size={14} />}
        <span
          className="h-4 w-4 shrink-0 rounded-full border border-border"
          style={{ backgroundColor: current?.preview }}
          title={current?.name}
        />
      </button>

      {open && (
        <div className="absolute bottom-full left-3 right-3 z-50 mb-1 max-h-[70vh] overflow-y-auto rounded-xl border border-border bg-surface p-2 shadow-xl">
          <div className="mb-2 flex items-center justify-between px-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">Aparência</p>
            <button
              type="button"
              onClick={toggleMode}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-surface2 px-2.5 py-1 text-xs transition hover:border-brand/50"
              title={mode === "dark" ? "Mudar para claro" : "Mudar para escuro"}
            >
              {mode === "dark" ? <Moon size={13} /> : <Sun size={13} />}
              {mode === "dark" ? "Escuro" : "Claro"}
            </button>
          </div>

          <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted">Paleta de cores</p>
          <div className="grid grid-cols-2 gap-0.5">
            {PALETTES.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => selectPalette(p.id)}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition hover:bg-surface2",
                  palette === p.id && "bg-brand/10",
                )}
              >
                <span
                  className="h-5 w-5 shrink-0 rounded-full border border-border"
                  style={{ backgroundColor: p.preview }}
                />
                <span className="flex-1 truncate text-left text-xs">{p.name}</span>
                {palette === p.id && <Check size={13} className="shrink-0 text-brand" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
