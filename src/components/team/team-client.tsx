"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Check, UserX } from "lucide-react";
import { Button, Card, Input, Select, Label, Textarea, Badge } from "@/components/ui";
import { createUser, importUsersFromCsv, setUserRole, approveUser, rejectUser, updateUserProfile } from "@/plugins/team/actions";

export const ROLES: Record<string, string> = {
  admin: "Administrador", researcher: "Pesquisador", phd: "Doutorando", msc: "Mestrando", student: "Aluno",
};

export function NewUserButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("researcher");
  const [title, setTitle] = useState("");
  const [csv, setCsv] = useState("");
  const [error, setError] = useState("");
  const [csvResult, setCsvResult] = useState("");
  const [pending, start] = useTransition();
  return (
    <>
      <div className="flex gap-2">
        <Button onClick={() => setOpen(true)}><Plus size={16} /> Novo usuario</Button>
        <Button variant="outline" onClick={() => { setCsvOpen(true); setCsvResult(""); setError(""); }}>
          Importar CSV
        </Button>
      </div>
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
              <div><Label>Titulo (opcional)</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="ex: Postdoc" /></div>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button disabled={pending || !name || !email || !password} onClick={() => start(async () => {
                  setError("");
                  try { await createUser({ name, email, password, role, title }); setOpen(false); setName(""); setEmail(""); setPassword(""); router.refresh(); }
                  catch (e) { setError(e instanceof Error ? e.message : "Erro"); }
                })}>Criar</Button>
              </div>
            </div>
          </Card>
        </div>
      )}
      {csvOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setCsvOpen(false)}>
          <Card className="w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold">Importar usuarios (CSV)</h2>
              <button onClick={() => setCsvOpen(false)} className="rounded-lg p-1 text-muted hover:bg-surface2"><X size={18} /></button>
            </div>
            <p className="mb-2 text-xs text-muted">
              Colunas: name, email, password, role, title. Primeira linha pode ser cabecalho.
            </p>
            <Textarea
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              rows={8}
              className="font-mono text-xs"
              placeholder={"name,email,password,role,title\nMaria Silva,maria@lab.edu,senha123,msc,Mestranda"}
            />
            {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
            {csvResult && <p className="mt-2 text-sm text-brand">{csvResult}</p>}
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCsvOpen(false)}>Fechar</Button>
              <Button disabled={pending || !csv.trim()} onClick={() => start(async () => {
                setError("");
                setCsvResult("");
                try {
                  const r = await importUsersFromCsv(csv);
                  setCsvResult(`${r.created} criado(s), ${r.skipped} ignorado(s)${r.errors.length ? `, ${r.errors.length} erro(s)` : ""}`);
                  if (r.errors.length) setError(r.errors.slice(0, 3).join(" | "));
                  if (r.created > 0) router.refresh();
                } catch (e) { setError(e instanceof Error ? e.message : "Erro"); }
              })}>Importar</Button>
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
  title: string | null;
  role: string;
  createdAt: string;
};

export function PendingUsersPanel({ users }: { users: PendingUserRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [roles, setRoles] = useState<Record<string, string>>(
    Object.fromEntries(users.map((u) => [u.id, u.role])),
  );
  const [titles, setTitles] = useState<Record<string, string>>(
    Object.fromEntries(users.map((u) => [u.id, u.title ?? ""])),
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
            <div className="mb-3 grid gap-3 sm:grid-cols-2">
              <div>
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
              <div>
                <Label>Titulo</Label>
                <Input
                  value={titles[u.id] ?? ""}
                  onChange={(e) => setTitles((t) => ({ ...t, [u.id]: e.target.value }))}
                  placeholder="ex: Mestrando"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    setError("");
                    try {
                      await approveUser(u.id, {
                        role: roles[u.id] ?? u.role,
                        title: titles[u.id] ?? "",
                      });
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

export function UserProfileEditor({
  userId,
  role,
  title,
}: {
  userId: string;
  role: string;
  title: string | null;
}) {
  const router = useRouter();
  const [r, setR] = useState(role);
  const [t, setT] = useState(title ?? "");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");

  return (
    <Card className="mb-6 p-5">
      <h2 className="mb-1 text-sm font-semibold">Perfil do usuario (admin)</h2>
      <p className="mb-4 text-xs text-muted">Papel global e titulo — controla acesso aos recursos do laboratorio.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Papel</Label>
          <Select value={r} className="w-full" onChange={(e) => setR(e.target.value)}>
            {Object.entries(ROLES).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Titulo</Label>
          <Input value={t} onChange={(e) => setT(e.target.value)} placeholder="ex: Doutorando" />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setMsg("");
              await updateUserProfile(userId, { role: r, title: t || null });
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
