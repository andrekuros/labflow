"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Bot, CheckCircle2, Sparkles } from "lucide-react";
import { Button, Card, Input, Label } from "@/components/ui";
import {
  loadSprintPlannerContextAction,
  suggestSprintPlanWithAiAction,
} from "@/plugins/sprints/actions";

type Member = {
  userId: string;
  name: string;
  role: string;
  profilesLabel: string;
  openTaskCount: number;
};

function addWeeks(date: Date, weeks: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + weeks * 7);
  return d;
}

function toDateInput(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function SprintAiWizard({
  projectId,
  projectKey,
  members: initialMembers,
  sprintCount,
  defaultDurationWeeks,
}: {
  projectId: string;
  projectKey: string;
  members: Member[];
  sprintCount: number;
  defaultDurationWeeks: number;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{ draftId: string; title: string } | null>(null);
  const [eligibleCount, setEligibleCount] = useState<number | null>(null);

  const [name, setName] = useState(`Sprint ${sprintCount + 1}`);
  const [durationWeeks, setDurationWeeks] = useState(defaultDurationWeeks);
  const [startDate, setStartDate] = useState(toDateInput(new Date()));
  const [endDate, setEndDate] = useState(toDateInput(addWeeks(new Date(), defaultDurationWeeks)));
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(
    () => new Set(initialMembers.map((m) => m.userId)),
  );

  const members = initialMembers;

  useEffect(() => {
    start(async () => {
      try {
        const ctx = await loadSprintPlannerContextAction(projectId);
        setEligibleCount(ctx.eligibleTasks.length);
        if (!name || name === `Sprint ${sprintCount + 1}`) {
          setName(`Sprint ${ctx.sprintCount + 1}`);
        }
      } catch {
        // context refresh is best-effort
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const endDateDerived = useMemo(() => {
    if (!startDate) return endDate;
    const start = new Date(startDate);
    if (Number.isNaN(start.getTime())) return endDate;
    return toDateInput(addWeeks(start, durationWeeks));
  }, [startDate, durationWeeks, endDate]);

  function toggleMember(userId: string) {
    setSelectedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  function onDurationChange(weeks: number) {
    const w = Math.max(1, Math.min(12, weeks));
    setDurationWeeks(w);
    if (startDate) {
      const start = new Date(startDate);
      if (!Number.isNaN(start.getTime())) setEndDate(toDateInput(addWeeks(start, w)));
    }
  }

  function onStartChange(value: string) {
    setStartDate(value);
    if (value) {
      const start = new Date(value);
      if (!Number.isNaN(start.getTime())) setEndDate(toDateInput(addWeeks(start, durationWeeks)));
    }
  }

  function generate() {
    setError("");
    setSuccess(null);
    if (selectedMembers.size === 0) {
      setError("Selecione pelo menos um membro da equipe.");
      return;
    }
    start(async () => {
      const result = await suggestSprintPlanWithAiAction({
        projectId,
        name: name.trim() || `Sprint ${sprintCount + 1}`,
        durationWeeks,
        startDate: startDate || null,
        endDate: endDateDerived || endDate || null,
        teamMemberIds: [...selectedMembers],
      });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setSuccess({ draftId: result.draftId, title: result.title });
    });
  }

  if (success) {
    return (
      <Card className="border-brand/30 bg-brand/5 p-4">
        <div className="flex items-start gap-3">
          <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-brand" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Rascunho criado</p>
            <p className="mt-1 text-xs text-muted">{success.title}</p>
            <p className="mt-2 text-xs text-muted">
              Revise o plano na aba Revisao IA do projeto antes de aceitar. Voce pode editar o JSON para remover
              tarefas da sprint.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href={`/projects/${projectId}?tab=review`}>
                <Button size="sm">
                  <Sparkles size={14} /> Revisar rascunho
                </Button>
              </Link>
              <Button size="sm" variant="outline" onClick={() => setSuccess(null)}>
                Nova sugestao
              </Button>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <Bot size={16} className="text-brand" />
        <h3 className="text-sm font-semibold">Planejar sprint com IA</h3>
      </div>
      <p className="mb-4 text-xs text-muted">
        Defina semanas e equipe; a IA sugere tarefas pendentes para incluir na sprint. O plano vai para Revisao IA
        antes de criar a sprint.
        {eligibleCount != null && (
          <span className="mt-1 block">{eligibleCount} tarefa(s) pendente(s) sem sprint no projeto {projectKey}.</span>
        )}
      </p>

      {error && <p className="mb-3 text-sm text-red-500">{error}</p>}

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Sprint 3" />
          </div>
          <div>
            <Label>Duracao (semanas)</Label>
            <Input
              type="number"
              min={1}
              max={12}
              value={durationWeeks}
              onChange={(e) => onDurationChange(Number(e.target.value) || 1)}
            />
          </div>
          <div>
            <Label>Inicio</Label>
            <Input type="date" value={startDate} onChange={(e) => onStartChange(e.target.value)} />
          </div>
          <div>
            <Label>Fim</Label>
            <Input type="date" value={endDateDerived} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>

        <div>
          <Label className="mb-2 block">Equipe envolvida</Label>
          {members.length === 0 ? (
            <p className="text-xs text-muted">Nenhum membro no projeto.</p>
          ) : (
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
              {members.map((m) => (
                <label key={m.userId} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-surface2">
                  <input
                    type="checkbox"
                    checked={selectedMembers.has(m.userId)}
                    onChange={() => toggleMember(m.userId)}
                    className="rounded border-border"
                  />
                  <span className="min-w-0 flex-1 truncate">{m.name}</span>
                  <span className="shrink-0 text-xs text-muted">
                    {m.role} · {m.openTaskCount} abertas
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Button disabled={pending || !name.trim() || members.length === 0} onClick={generate}>
            <Sparkles size={14} /> {pending ? "Gerando..." : "Sugerir com IA"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
