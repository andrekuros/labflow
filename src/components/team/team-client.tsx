"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { Button, Card, Input, Select, Label } from "@/components/ui";
import { createUser, setUserRole } from "@/plugins/team/actions";

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
  const [title, setTitle] = useState("");
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
