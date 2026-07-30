"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, BookOpen, Code2, Shield } from "lucide-react";
import { setWorkspacePrefs } from "@/app/actions/preferences";
import {
  DEFAULT_KIND_TOGGLES,
  KIND_TOGGLE_META,
  workspaceFromToggles,
  type KindToggleKey,
  type KindToggles,
  type WorkspacePrefs,
} from "@/lib/workspace-prefs";
import { cn } from "@/lib/utils";

const ICONS = {
  GraduationCap,
  BookOpen,
  Code2,
  Shield,
} as const;

export function WorkspaceKindToggles({
  workspace,
}: {
  workspace: WorkspacePrefs;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const toggles: KindToggles = workspace.kindToggles ?? { ...DEFAULT_KIND_TOGGLES };

  function toggle(key: KindToggleKey) {
    const next: KindToggles = { ...toggles, [key]: !toggles[key] };
    // Keep at least one filter on so the user never sees an empty lab by accident
    if (!KIND_TOGGLE_META.some((m) => next[m.key])) {
      next[key] = true;
    }

    start(async () => {
      await setWorkspacePrefs(workspaceFromToggles(next, workspace));
      router.refresh();
    });
  }

  return (
    <div
      className="flex items-center gap-1"
      role="group"
      aria-label="Filtros de contexto"
    >
      {KIND_TOGGLE_META.map((meta) => {
        const Icon = ICONS[meta.icon];
        const active = toggles[meta.key];
        return (
          <button
            key={meta.key}
            type="button"
            title={`${meta.label}${active ? " (ativo)" : " (inativo)"}`}
            aria-pressed={active}
            disabled={pending}
            onClick={() => toggle(meta.key)}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-lg border transition",
              active
                ? "border-transparent shadow-sm"
                : "border-transparent bg-transparent text-muted/45 hover:bg-surface2 hover:text-muted",
              pending && "opacity-60",
            )}
            style={
              active
                ? {
                    backgroundColor: `${meta.activeColor}22`,
                    color: meta.activeColor,
                  }
                : undefined
            }
          >
            <Icon size={18} strokeWidth={active ? 2.25 : 1.75} />
          </button>
        );
      })}
    </div>
  );
}
