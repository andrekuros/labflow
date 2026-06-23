"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, MessageSquarePlus } from "lucide-react";
import { Button, Card, Input, Textarea, Select, Label } from "@/components/ui";
import { createChannel, createThread } from "@/plugins/forum/actions";

export function NewChannelButton({ projects }: { projects: { id: string; key: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState("");
  const [pending, start] = useTransition();
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}><Plus size={16} /> Novo canal</Button>
      {open && (
        <Modal title="Novo canal" onClose={() => setOpen(false)}>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex: metodologia" /></div>
            <div><Label>Descricao</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
            <div><Label>Projeto</Label>
              <Select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="w-full">
                <option value="">(geral / todos)</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.key} - {p.name}</option>)}
              </Select>
            </div>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button disabled={pending || !name} onClick={() => start(async () => { await createChannel({ name, description, projectId: projectId || null }); setOpen(false); setName(""); router.refresh(); })}>Criar</Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

export function NewThreadButton({ channels }: { channels: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [channelId, setChannelId] = useState(channels[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [pending, start] = useTransition();
  if (channels.length === 0) return null;
  return (
    <>
      <Button onClick={() => setOpen(true)}><MessageSquarePlus size={16} /> Novo topico</Button>
      {open && (
        <Modal title="Novo topico" onClose={() => setOpen(false)}>
          <div className="space-y-3">
            <div><Label>Canal</Label>
              <Select value={channelId} onChange={(e) => setChannelId(e.target.value)} className="w-full">
                {channels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </div>
            <div><Label>Titulo</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
            <div><Label>Mensagem</Label><Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={5} /></div>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button disabled={pending || !title || !content} onClick={() => start(async () => { await createThread({ channelId, title, content }); setOpen(false); setTitle(""); setContent(""); router.refresh(); })}>Publicar</Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <Card className="w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-surface2"><X size={18} /></button>
        </div>
        {children}
      </Card>
    </div>
  );
}
