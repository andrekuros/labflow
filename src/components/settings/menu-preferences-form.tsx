"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Label } from "@/components/ui";
import { saveUserPreferences } from "@/app/actions/preferences";
import type { UserPreferences } from "@/lib/user-preferences";
import type { NavItem } from "@/plugins/types";

type MenuEntry = { id: string; label: string };

export function MenuPreferencesForm({
  navItems,
  preferences,
}: {
  navItems: NavItem[];
  preferences: UserPreferences;
}) {
  const router = useRouter();
  const [hidden, setHidden] = useState<Set<string>>(new Set(preferences.navHidden ?? []));
  const [collapsed, setCollapsed] = useState(Boolean(preferences.sidebarCollapsed));
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

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
    setSaved(false);
  };

  return (
    <Card className="p-5">
      <h2 className="mb-1 text-sm font-semibold">Menu lateral</h2>
      <p className="mb-4 text-xs text-muted">Escolha quais modulos aparecem e se o menu fica recolhido.</p>

      <label className="mb-4 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={collapsed}
          onChange={(e) => {
            setCollapsed(e.target.checked);
            setSaved(false);
          }}
        />
        Recolher menu para o canto (somente icones)
      </label>

      <Label className="mb-2 block">Itens visiveis no menu</Label>
      <div className="mb-4 grid gap-2 sm:grid-cols-2">
        {entries.map((e) => (
          <label key={e.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
            <input type="checkbox" checked={!hidden.has(e.id)} onChange={() => toggle(e.id)} />
            {e.label}
          </label>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await saveUserPreferences({
                navHidden: [...hidden],
                sidebarCollapsed: collapsed,
              });
              setSaved(true);
              router.refresh();
            })
          }
        >
          Salvar preferencias do menu
        </Button>
        {saved && <span className="text-xs text-brand">Salvo.</span>}
      </div>
    </Card>
  );
}
