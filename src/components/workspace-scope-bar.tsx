import { Filter, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Tells the reader which project set the numbers on the page cover.
 *
 * Without it, flipping a topbar kind toggle silently changes every KPI and the
 * page looks broken instead of filtered.
 */
export function WorkspaceScopeBar({
  label,
  scopedCount,
  visibleCount,
  focused,
  className,
  children,
}: {
  label: string;
  scopedCount: number;
  visibleCount: number;
  focused: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "mb-5 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border px-3 py-2 text-xs",
        focused
          ? "border-brand/35 bg-brand/5"
          : "border-border bg-surface2/40",
        className,
      )}
    >
      <span className={cn("flex items-center gap-1.5 font-medium", focused ? "text-brand" : "text-muted")}>
        {focused ? <Filter size={13} /> : <Layers size={13} />}
        {label}
      </span>
      <span className="text-muted">
        {focused ? (
          <>
            {scopedCount} de {visibleCount} projeto{visibleCount === 1 ? "" : "s"} — os numeros abaixo
            contam apenas este contexto
          </>
        ) : (
          <>
            {visibleCount} projeto{visibleCount === 1 ? "" : "s"} — todo o laboratorio
          </>
        )}
      </span>
      {children && <div className="ml-auto flex items-center gap-2">{children}</div>}
    </div>
  );
}
