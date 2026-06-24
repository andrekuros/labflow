"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SlidersHorizontal, X } from "lucide-react";
import { Button, Card, Label } from "@/components/ui";
import { saveUserPreferences } from "@/app/actions/preferences";
import type { UserPreferences } from "@/lib/user-preferences";
import type { NavItem } from "@/plugins/types";

type MenuEntry = { id: string; label: string };

export function SidebarMenuSettings({
  navItems,
  preferences,
}: {
  navItems: NavItem[];
  preferences: UserPreferences;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState<Set<string>>(new Set(preferences.navHidden ?? []));
  const [collapsed, setCollapsed] = useState(Boolean(preferences.sidebarCollapsed));
  const [pending, start] = useTransition();

  const entries: MenuEntry[] = [
    { id: "__dashboard", label: "Dashboard" },
    ...navItems.map((n) => ({ id: n.pluginId, label: n.label })),
  ];

  const toggle = (id: string) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setHidden(new Set(preferences.navHidden ?? []));
          setCollapsed(Boolean(preferences.sidebarCollapsed));
          setOpen(true);
        }}
        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-muted transition hover:bg-surface2 hover:text-fg"
        title="Personalizar menu"
      >
        <SlidersHorizontal size={16} />
        <span>Personalizar menu</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <Card className="w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold">Menu lateral</h2>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1 text-muted hover:bg-surface2"><X size={18} /></button>
            </div>

            <label className="mb-4 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={collapsed} onChange={(e) => setCollapsed(e.target.checked)} />
              Recolher menu para o canto (somente icones)
            </label>

            <Label className="mb-2 block">Itens visiveis</Label>
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {entries.map((e) => (
                <label key={e.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={!hidden.has(e.id)} onChange={() => toggle(e.id)} />
                  {e.label}
                </label>
              ))}
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    await saveUserPreferences({
                      navHidden: [...hidden],
                      sidebarCollapsed: collapsed,
                    });
                    setOpen(false);
                    router.refresh();
                  })
                }
              >
                Salvar
              </Button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
