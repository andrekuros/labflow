"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Check, UserX } from "lucide-react";
import { Button, Card, Input, Select, Label, Badge } from "@/components/ui";
import { createUser, setUserRole, approveUser, rejectUser, updateUserProfile } from "@/plugins/team/actions";

export const ROLES: Record<string, string> = {
  admin: "Administrador", researcher: "Pesquisador", phd: "Doutorando", msc: "Mestrando", student: "Aluno",
};

export function NewUserButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("researcher");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <>
      <Button onClick={() => setOpen(true)}><Plus size={16} /> Novo usuario</Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <Card className="w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold">Novo usuario</h2>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1 text-muted hover:bg-surface2"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Senha</Label><Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
                <div><Label>Papel</Label>
                  <Select value={role} onChange={(e) => setRole(e.target.value)} className="w-full">
                    {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </Select>
                </div>
              </div>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button disabled={pending || !name || !email || !password} onClick={() => start(async () => {
                  setError("");
                  try { await createUser({ name, email, password, role }); setOpen(false); setName(""); setEmail(""); setPassword(""); router.refresh(); }
                  catch (e) { setError(e instanceof Error ? e.message : "Erro"); }
                })}>Criar</Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

export function RoleControl({ userId, role }: { userId: string; role: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Select value={role} disabled={pending} onChange={(e) => start(async () => { await setUserRole(userId, e.target.value); router.refresh(); })}>
      {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
    </Select>
  );
}

export type PendingUserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
};

export function PendingUsersPanel({ users }: { users: PendingUserRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [roles, setRoles] = useState<Record<string, string>>(
    Object.fromEntries(users.map((u) => [u.id, u.role])),
  );
  const [error, setError] = useState("");

  if (users.length === 0) return null;

  return (
    <Card className="mb-6 p-5">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-semibold">Cadastros aguardando aprovacao</h2>
        <Badge className="bg-amber-500/15 text-amber-600">{users.length}</Badge>
      </div>
      <p className="mb-4 text-xs text-muted">Somente administradores podem aprovar acesso e definir papel do usuario.</p>
      {error && <p className="mb-2 text-sm text-red-400">{error}</p>}
      <div className="space-y-3">
        {users.map((u) => (
          <div key={u.id} className="rounded-lg border border-border p-4">
            <div className="mb-3">
              <p className="font-medium">{u.name}</p>
              <p className="text-xs text-muted">{u.email} · {new Date(u.createdAt).toLocaleString("pt-BR")}</p>
            </div>
            <div className="mb-3">
              <Label>Papel ao aprovar</Label>
              <Select
                value={roles[u.id] ?? u.role}
                className="w-full"
                onChange={(e) => setRoles((r) => ({ ...r, [u.id]: e.target.value }))}
              >
                {Object.entries(ROLES).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </Select>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    setError("");
                    try {
                      await approveUser(u.id, { role: roles[u.id] ?? u.role });
                      router.refresh();
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "Erro");
                    }
                  })
                }
              >
                <Check size={14} /> Aprovar
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    setError("");
                    try {
                      await rejectUser(u.id);
                      router.refresh();
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "Erro");
                    }
                  })
                }
              >
                <UserX size={14} /> Rejeitar
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function UserProfileEditor({ userId, role }: { userId: string; role: string }) {
  const router = useRouter();
  const [r, setR] = useState(role);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");

  return (
    <Card className="mb-6 p-5">
      <h2 className="mb-1 text-sm font-semibold">Perfil do usuario (admin)</h2>
      <p className="mb-4 text-xs text-muted">Papel global — controla acesso aos recursos do laboratorio.</p>
      <div>
        <Label>Papel</Label>
        <Select value={r} className="w-full" onChange={(e) => setR(e.target.value)}>
          {Object.entries(ROLES).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </Select>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setMsg("");
              await updateUserProfile(userId, { role: r });
              setMsg("Salvo.");
              router.refresh();
            })
          }
        >
          Salvar perfil
        </Button>
        {msg && <span className="text-xs text-brand">{msg}</span>}
      </div>
    </Card>
  );
}
