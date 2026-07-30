"use client";

import { useState, useTransition, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, X, Check, UserX, Trash2, ExternalLink, Upload, Download } from "lucide-react";
import { Card, Button, Input, Label, Badge, Textarea } from "@/components/ui";
import {
  listUsersForSettingsAction,
  saveUserFromSettingsAction,
  rejectUserFromSettingsAction,
  createUserFromSettingsAction,
  deleteUserFromSettingsAction,
  importUsersFromCsvAction,
  type UserRow,
} from "@/app/actions/users";
import { exportUserBundleAction, importUserBundleAction } from "@/app/actions/data-transfer";
import { PROFILE_LABELS, SYSTEM_PROFILES } from "@/lib/profile-meta";
import { ACCOUNT_STATUS_LABELS } from "@/lib/user-meta";

const STATUS_COLORS: Record<string, string> = {
  active: "#22c55e",
  pending: "#f59e0b",
  rejected: "#ef4444",
};

function ProfilePicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (profiles: string[]) => void;
}) {
  const set = new Set(selected);
  function toggle(profile: string) {
    const next = new Set(set);
    if (next.has(profile)) next.delete(profile);
    else next.add(profile);
    onChange([...next]);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {SYSTEM_PROFILES.map((p) => {
        const active = set.has(p);
        return (
          <button
            key={p}
            type="button"
            onClick={() => toggle(p)}
            className={`rounded-full border px-3 py-1 text-xs transition ${
              active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted hover:bg-surface2"
            }`}
          >
            {PROFILE_LABELS[p]}
          </button>
        );
      })}
    </div>
  );
}

function ProfileBadges({ profiles }: { profiles: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {profiles.map((p) => (
        <Badge key={p} color={p === "admin" ? "#ef4444" : "#6366f1"} className="text-[10px]">
          {PROFILE_LABELS[p as keyof typeof PROFILE_LABELS] ?? p}
        </Badge>
      ))}
    </div>
  );
}

export function UsersTab() {
  const router = useRouter();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [editProfiles, setEditProfiles] = useState<string[]>([]);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newProfiles, setNewProfiles] = useState<string[]>(["researcher"]);
  const [csvOpen, setCsvOpen] = useState(false);
  const [csv, setCsv] = useState("");
  const [csvResult, setCsvResult] = useState("");
  const [userJsonOpen, setUserJsonOpen] = useState(false);
  const [userJson, setUserJson] = useState("");
  const [userJsonResult, setUserJsonResult] = useState("");

  function openEditor(user: UserRow) {
    setEditing(user);
    setEditProfiles(user.profiles.length ? user.profiles : ["contributor"]);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditPassword("");
    setError("");
  }

  function reload() {
    start(async () => {
      setUsers(await listUsersForSettingsAction());
      setLoaded(true);
    });
  }

  useEffect(() => {
    reload();
  }, []);

  if (!loaded) return <p className="text-sm text-muted">Carregando usuarios...</p>;

  const pendingUsers = users.filter((u) => u.accountStatus === "pending");
  const activeUsers = users.filter((u) => u.accountStatus !== "pending");

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Usuarios do laboratorio</h2>
            <p className="text-sm text-muted">
              Perfis acumulam permissoes — um usuario pode ser pesquisador e mestrando ao mesmo tempo.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus size={14} /> Novo usuario
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setCsvOpen(true);
                setCsvResult("");
                setError("");
              }}
            >
              <Upload size={14} /> Importar CSV
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setUserJsonOpen(true);
                setUserJsonResult("");
                setUserJson("");
                setError("");
              }}
            >
              <Upload size={14} /> Importar JSON
            </Button>
          </div>
        </div>

        {error && <p className="mb-3 text-sm text-red-500">{error}</p>}

        {pendingUsers.length > 0 && (
          <div className="mb-6">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
              Aguardando aprovacao ({pendingUsers.length})
            </h3>
            <div className="space-y-2">
              {pendingUsers.map((u) => (
                <div key={u.id} className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <Link href={`/team/${u.id}`} className="font-medium hover:text-primary hover:underline">
                        {u.name}
                      </Link>
                      <p className="text-xs text-muted">{u.email}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        disabled={pending}
                        onClick={() => openEditor(u)}
                      >
                        Revisar
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="px-2 py-2">Usuario</th>
                <th className="px-2 py-2">Perfis</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2 text-right">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {activeUsers.map((u) => (
                <tr key={u.id} className="border-b border-border/50">
                  <td className="px-2 py-2">
                    <Link href={`/team/${u.id}`} className="group block">
                      <p className="font-medium group-hover:text-primary group-hover:underline">{u.name}</p>
                      <p className="text-xs text-muted">{u.email}</p>
                    </Link>
                  </td>
                  <td className="px-2 py-2">
                    <ProfileBadges profiles={u.profiles} />
                  </td>
                  <td className="px-2 py-2">
                    <Badge color={STATUS_COLORS[u.accountStatus] ?? "#64748b"}>
                      {ACCOUNT_STATUS_LABELS[u.accountStatus as keyof typeof ACCOUNT_STATUS_LABELS] ?? u.accountStatus}
                    </Badge>
                  </td>
                  <td className="px-2 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      <Link href={`/team/${u.id}`}>
                        <Button size="sm" variant="outline" title="Ver perfil">
                          <ExternalLink size={12} />
                        </Button>
                      </Link>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() => openEditor(u)}
                      >
                        Editar
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditing(null)}>
          <Card className="w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">{editing.name}</h2>
                <Link href={`/team/${editing.id}`} className="text-xs text-primary hover:underline">
                  Abrir perfil completo
                </Link>
              </div>
              <button type="button" onClick={() => setEditing(null)} className="rounded-lg p-1 text-muted hover:bg-surface2">
                <X size={18} />
              </button>
            </div>
            <p className="mb-4 text-xs text-muted">
              {editing.accountStatus === "pending" ? "Cadastro aguardando aprovacao" : ACCOUNT_STATUS_LABELS[editing.accountStatus as keyof typeof ACCOUNT_STATUS_LABELS] ?? editing.accountStatus}
            </p>

            <div className="space-y-4">
              <div><Label>Nome</Label><Input value={editName} onChange={(e) => setEditName(e.target.value)} /></div>
              <div><Label>Email</Label><Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} /></div>
              <div>
                <Label>Nova senha</Label>
                <Input
                  type="text"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="Deixe vazio para manter a atual"
                />
              </div>
              <div>
                <Label className="mb-2 block">Perfis (acumulativos)</Label>
                <ProfilePicker selected={editProfiles} onChange={setEditProfiles} />
              </div>
            </div>

            {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

            <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      setError("");
                      try {
                        const text = await exportUserBundleAction(editing.id);
                        const blob = new Blob([text], { type: "application/json" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `labflow-user-${editing.email.split("@")[0]}.json`;
                        a.click();
                        URL.revokeObjectURL(url);
                      } catch (e) {
                        setError(e instanceof Error ? e.message : "Erro ao exportar");
                      }
                    })
                  }
                >
                  <Download size={14} /> Exportar pacote
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      if (!confirm(`Excluir permanentemente "${editing.name}"?`)) return;
                      setError("");
                      try {
                        await deleteUserFromSettingsAction(editing.id);
                        setEditing(null);
                        reload();
                        router.refresh();
                      } catch (e) {
                        setError(e instanceof Error ? e.message : "Erro ao excluir");
                      }
                    })
                  }
                >
                  <Trash2 size={14} /> Excluir
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
              {editing.accountStatus === "pending" && (
                <Button
                  variant="danger"
                  size="sm"
                  disabled={pending || editProfiles.length === 0}
                  onClick={() =>
                    start(async () => {
                      setError("");
                      try {
                        await rejectUserFromSettingsAction(editing.id);
                        setEditing(null);
                        reload();
                        router.refresh();
                      } catch (e) {
                        setError(e instanceof Error ? e.message : "Erro");
                      }
                    })
                  }
                >
                  <UserX size={14} /> Rejeitar
                </Button>
              )}
              <Button
                size="sm"
                disabled={pending || editProfiles.length === 0 || !editName.trim() || !editEmail.trim()}
                onClick={() =>
                  start(async () => {
                    setError("");
                    try {
                      await saveUserFromSettingsAction(editing.id, {
                        name: editName.trim(),
                        email: editEmail.trim(),
                        password: editPassword || undefined,
                        profiles: editProfiles,
                        approve: editing.accountStatus === "pending",
                      });
                      setEditing(null);
                      reload();
                      router.refresh();
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "Erro");
                    }
                  })
                }
              >
                <Check size={14} /> {editing.accountStatus === "pending" ? "Aprovar" : "Salvar"}
              </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setCreateOpen(false)}>
          <Card className="w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold">Novo usuario</h2>
              <button type="button" onClick={() => setCreateOpen(false)} className="rounded-lg p-1 text-muted hover:bg-surface2">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <div><Label>Nome</Label><Input value={newName} onChange={(e) => setNewName(e.target.value)} /></div>
              <div><Label>Email</Label><Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} /></div>
              <div><Label>Senha</Label><Input type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></div>
              <div>
                <Label className="mb-2 block">Perfis</Label>
                <ProfilePicker selected={newProfiles} onChange={setNewProfiles} />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
              <Button
                disabled={pending || !newName || !newEmail || !newPassword || newProfiles.length === 0}
                onClick={() =>
                  start(async () => {
                    setError("");
                    try {
                      await createUserFromSettingsAction({
                        name: newName,
                        email: newEmail,
                        password: newPassword,
                        profiles: newProfiles,
                      });
                      setCreateOpen(false);
                      setNewName("");
                      setNewEmail("");
                      setNewPassword("");
                      reload();
                      router.refresh();
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "Erro");
                    }
                  })
                }
              >
                Criar
              </Button>
            </div>
          </Card>
        </div>
      )}

      {csvOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setCsvOpen(false)}
        >
          <Card className="w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold">Importar usuarios (CSV)</h2>
              <button
                type="button"
                onClick={() => setCsvOpen(false)}
                className="rounded-lg p-1 text-muted hover:bg-surface2"
              >
                <X size={18} />
              </button>
            </div>
            <p className="mb-2 text-xs text-muted">
              Colunas: name, email, password, role, profiles. Use profiles para varios perfis
              (ex: researcher;msc). A primeira linha pode ser cabecalho.
            </p>
            <Textarea
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              rows={8}
              className="font-mono text-xs"
              placeholder={
                "name,email,password,role,profiles\nMaria Silva,maria@lab.edu,senha123,msc,researcher;msc"
              }
            />
            {csvResult && <p className="mt-2 text-sm text-brand">{csvResult}</p>}
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCsvOpen(false)}>
                Fechar
              </Button>
              <Button
                disabled={pending || !csv.trim()}
                onClick={() =>
                  start(async () => {
                    setError("");
                    setCsvResult("");
                    try {
                      const r = await importUsersFromCsvAction(csv);
                      setCsvResult(
                        `${r.created} criado(s), ${r.skipped} ignorado(s)${
                          r.errors.length ? `, ${r.errors.length} erro(s)` : ""
                        }`,
                      );
                      if (r.errors.length) setError(r.errors.slice(0, 5).join(" | "));
                      if (r.created > 0) {
                        reload();
                        router.refresh();
                      }
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "Erro");
                    }
                  })
                }
              >
                Importar
              </Button>
            </div>
          </Card>
        </div>
      )}

      {userJsonOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setUserJsonOpen(false)}
        >
          <Card className="w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold">Importar usuario (JSON)</h2>
              <button
                type="button"
                onClick={() => setUserJsonOpen(false)}
                className="rounded-lg p-1 text-muted hover:bg-surface2"
              >
                <X size={18} />
              </button>
            </div>
            <p className="mb-2 text-xs text-muted">
              Pacote completo exportado de outro servidor (inclui hash de senha, perfis, perfil academico e memberships).
              Atualiza usuario existente com mesmo email.
            </p>
            <Textarea
              value={userJson}
              onChange={(e) => setUserJson(e.target.value)}
              rows={8}
              className="font-mono text-xs"
              placeholder='{"version":"1.0","kind":"user",...}'
            />
            {userJsonResult && <p className="mt-2 text-sm text-brand">{userJsonResult}</p>}
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setUserJsonOpen(false)}>
                Fechar
              </Button>
              <Button
                disabled={pending || !userJson.trim()}
                onClick={() =>
                  start(async () => {
                    setError("");
                    setUserJsonResult("");
                    try {
                      const r = await importUserBundleAction(userJson, "upsert");
                      setUserJsonResult(
                        `${r.created ? "Usuario criado" : "Usuario atualizado"}: ${r.email}${
                          r.warnings.length ? `. Avisos: ${r.warnings.slice(0, 3).join("; ")}` : ""
                        }`,
                      );
                      if (r.created || r.warnings.length === 0) {
                        reload();
                        router.refresh();
                      }
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "Erro");
                    }
                  })
                }
              >
                Importar
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
