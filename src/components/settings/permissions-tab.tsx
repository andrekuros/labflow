"use client";

import { useState, useTransition, useEffect } from "react";
import { Card, Button } from "@/components/ui";
import {
  listPermissionsAction,
  getRolePermissionsAction,
  updateRolePermissionsAction,
} from "@/app/actions/permissions";

const EDITABLE_ROLES = ["researcher", "project_manager", "contributor", "viewer"] as const;
const ROLE_LABELS: Record<string, string> = {
  researcher: "Pesquisador",
  project_manager: "Gerente",
  contributor: "Colaborador",
  viewer: "Visualizador",
};

type PermRow = { id: string; key: string; description: string; module: string; action: string };

export function PermissionsTab() {
  const [perms, setPerms] = useState<PermRow[]>([]);
  const [rolePerms, setRolePerms] = useState<Record<string, Set<string>>>({});
  const [pending, start] = useTransition();
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    start(async () => {
      const [p, rp] = await Promise.all([listPermissionsAction(), getRolePermissionsAction()]);
      setPerms(p);
      const mapped: Record<string, Set<string>> = {};
      for (const role of EDITABLE_ROLES) {
        mapped[role] = new Set(rp[role] ?? []);
      }
      setRolePerms(mapped);
      setLoaded(true);
    });
  }, []);

  if (!loaded) return <p className="text-sm text-muted">Carregando permissoes...</p>;

  const modules = [...new Set(perms.map((p) => p.module))];

  function toggle(role: string, key: string) {
    setSaved(false);
    setRolePerms((prev) => {
      const s = new Set(prev[role]);
      if (s.has(key)) s.delete(key);
      else s.add(key);
      return { ...prev, [role]: s };
    });
  }

  function saveAll() {
    start(async () => {
      for (const role of EDITABLE_ROLES) {
        await updateRolePermissionsAction(role, [...(rolePerms[role] ?? [])]);
      }
      setSaved(true);
    });
  }

  return (
    <Card className="p-5">
      <h2 className="mb-1 text-sm font-semibold">Permissoes por papel</h2>
      <p className="mb-4 text-sm text-muted">
        Admin sempre tem acesso total. Configure as permissoes dos demais papeis.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              <th className="px-2 py-2 text-left font-medium text-muted">Modulo</th>
              <th className="px-2 py-2 text-left font-medium text-muted">Permissao</th>
              {EDITABLE_ROLES.map((r) => (
                <th key={r} className="px-2 py-2 text-center font-medium text-muted">
                  {ROLE_LABELS[r]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {modules.map((mod) => {
              const modPerms = perms.filter((p) => p.module === mod);
              return modPerms.map((p, i) => (
                <tr key={p.key} className="border-b border-border/50">
                  {i === 0 && (
                    <td rowSpan={modPerms.length} className="px-2 py-1 align-top font-medium capitalize">
                      {mod.replace("_", " ")}
                    </td>
                  )}
                  <td className="px-2 py-1 text-muted" title={p.key}>
                    {p.description || p.key}
                  </td>
                  {EDITABLE_ROLES.map((role) => (
                    <td key={role} className="px-2 py-1 text-center">
                      <input
                        type="checkbox"
                        checked={rolePerms[role]?.has(p.key) ?? false}
                        onChange={() => toggle(role, p.key)}
                      />
                    </td>
                  ))}
                </tr>
              ));
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Button size="sm" disabled={pending} onClick={saveAll}>
          Salvar permissoes
        </Button>
        {saved && <span className="text-xs text-green-600">Salvo!</span>}
      </div>
    </Card>
  );
}
