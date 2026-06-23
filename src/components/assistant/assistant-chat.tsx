"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Send, Bot, User as UserIcon, FileText } from "lucide-react";
import { Button, Card, Textarea, Select, Badge } from "@/components/ui";
import { askAssistant } from "@/plugins/assistant/actions";
import type { AgentSource } from "@/lib/ai/agent";

type Msg = { role: "user" | "assistant"; content: string; sources?: AgentSource[] };

const SOURCE_HREF: Record<string, (id: string) => string> = {
  article: (id) => `/knowledge/${id}`,
  post: (id) => `/forum/${id}`,
  task: () => `/board`,
  deliverable: () => `/deliverables`,
};

export function AssistantChat({
  agents,
  aiEnabled,
}: {
  agents: { key: string; name: string; description: string | null }[];
  aiEnabled: boolean;
}) {
  const [agentKey, setAgentKey] = useState(agents[0]?.key ?? "");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [pending, start] = useTransition();

  function ask() {
    const q = input.trim();
    if (!q) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: q }]);
    start(async () => {
      const res = await askAssistant({ question: q, agentKey });
      setMessages((m) => [...m, { role: "assistant", content: res.answer, sources: res.sources }]);
    });
  }

  return (
    <Card className="flex h-[calc(100vh-200px)] flex-col">
      <div className="flex items-center justify-between border-b border-border p-3">
        <Select value={agentKey} onChange={(e) => setAgentKey(e.target.value)}>
          {agents.map((a) => <option key={a.key} value={a.key}>{a.name}</option>)}
        </Select>
        {!aiEnabled && <Badge color="#f59e0b">Modo offline (RAG sem LLM)</Badge>}
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center text-muted">
            <Bot size={32} className="mb-2" />
            <p className="text-sm">Pergunte sobre os projetos, decisoes e conhecimento acumulado.</p>
            <p className="mt-1 text-xs">Ex: &quot;Qual metrica decidimos usar para o decodificador?&quot;</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.role === "user" ? "justify-end" : ""}`}>
            {m.role === "assistant" && <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand"><Bot size={16} /></div>}
            <div className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm ${m.role === "user" ? "bg-brand text-brand-fg" : "bg-surface2"}`}>
              <p className="whitespace-pre-wrap">{m.content}</p>
              {m.sources && m.sources.length > 0 && (
                <div className="mt-3 border-t border-border/50 pt-2">
                  <p className="mb-1 text-[11px] font-medium text-muted">Fontes:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {m.sources.map((s) => (
                      <Link key={`${s.type}-${s.id}`} href={(SOURCE_HREF[s.type] ?? (() => "#"))(s.id)}
                        className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-0.5 text-[11px] hover:border-brand/60">
                        <FileText size={11} /> {s.title}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {m.role === "user" && <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface2"><UserIcon size={16} /></div>}
          </div>
        ))}
        {pending && <p className="text-sm text-muted">Pensando...</p>}
      </div>

      <div className="flex items-end gap-2 border-t border-border p-3">
        <Textarea value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(); } }}
          rows={2} placeholder="Pergunte ao assistente... (Enter para enviar)" />
        <Button onClick={ask} disabled={pending || !input.trim()}><Send size={15} /></Button>
      </div>
    </Card>
  );
}
