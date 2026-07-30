"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type MultiFilterOption = { value: string; label: string };

export function MultiFilter({
  label,
  options,
  values,
  onChange,
  disabled,
  title,
}: {
  label: string;
  options: MultiFilterOption[];
  values: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function toggle(value: string) {
    onChange(values.includes(value) ? values.filter((v) => v !== value) : [...values, value]);
  }

  const summary =
    values.length === 0
      ? label
      : values.length === 1
        ? options.find((o) => o.value === values[0])?.label ?? label
        : `${label} (${values.length})`;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        title={title}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex h-9 max-w-[220px] items-center gap-1.5 rounded-lg border border-border bg-surface2 px-2.5 text-sm outline-none transition hover:bg-surface disabled:opacity-60",
          values.length > 0 && "border-brand/40 text-fg",
          open && "ring-2 ring-brand/50",
        )}
      >
        <span className="truncate">{summary}</span>
        {values.length > 0 && !disabled ? (
          <span
            role="button"
            tabIndex={0}
            className="rounded p-0.5 text-muted hover:bg-surface hover:text-fg"
            onClick={(e) => {
              e.stopPropagation();
              onChange([]);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                onChange([]);
              }
            }}
          >
            <X size={12} />
          </span>
        ) : (
          <ChevronDown size={14} className="shrink-0 text-muted" />
        )}
      </button>
      {open && !disabled && (
        <div className="absolute left-0 z-30 mt-1 max-h-64 min-w-[200px] overflow-auto rounded-lg border border-border bg-surface p-1 shadow-lg">
          {options.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-muted">Nenhuma opcao</p>
          ) : (
            options.map((o) => {
              const checked = values.includes(o.value);
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => toggle(o.value)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface2"
                >
                  <span
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                      checked ? "border-brand bg-brand text-brand-fg" : "border-border",
                    )}
                  >
                    {checked ? <Check size={10} /> : null}
                  </span>
                  <span className="truncate">{o.label}</span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
