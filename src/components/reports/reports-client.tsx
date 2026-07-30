"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, Badge, Select, PageHeader, Avatar } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import {
  BarChart3,
  ClipboardList,
  CheckCircle2,
  FileText,
  MessageSquare,
  Copy,
  Download,
  Users,
  User as UserIcon,
  Calendar,
  Activity,
  Mail,
  Loader2,
  Sparkles,
  Presentation,
} from "lucide-react";
import type { UserActivitySummary, TeamMemberOverview } from "@/plugins/reports/actions";
import { exportActivityReport, generateWeeklyReportNow, exportLabPresentation } from "@/plugins/reports/actions";
import { generateReportMarkdown } from "@/plugins/reports/report-markdown";
import { AI_SECTION_OPTIONS, type AiAnalysisSection } from "@/plugins/reports/ai-sections";

type UserOption = { id: string; name: string; role: string; profilesLabel: string; avatarColor: string };

type Props = {
  view: "report" | "bi";
  isAdmin: boolean;
  users: UserOption[];
  selectedUserId: string;
  from: string;
  to: string;
  includeAcademic: boolean;
  summary?: UserActivitySummary;
  teamData?: TeamMemberOverview[];
};

const PRESETS = [
  { label: "7 dias", days: 7 },
  { label: "14 dias", days: 14 },
  { label: "30 dias", days: 30 },
  { label: "90 dias", days: 90 },
];

const DEFAULT_AI: AiAnalysisSection[] = [
  "executiveSummary",
  "highlights",
  "pendenciesAndRisks",
  "workflowImprovements",
];

function downloadPdfBase64(filename: string, base64: string) {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function AiSectionsPicker({
  selected,
  onChange,
}: {
  selected: AiAnalysisSection[];
  onChange: (next: AiAnalysisSection[]) => void;
}) {
  function toggle(key: AiAnalysisSection) {
    onChange(selected.includes(key) ? selected.filter((s) => s !== key) : [...selected, key]);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Sparkles size={14} className="text-brand" />
        Analise por IA (opcional)
      </div>
      <p className="text-xs text-muted">Marque o que incluir no Markdown e no PDF. Sem selecao, exporta so os dados.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {AI_SECTION_OPTIONS.map((opt) => (
          <label key={opt.key} className="flex items-start gap-2 rounded border border-border px-2.5 py-2 text-sm hover:bg-surface2">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={selected.includes(opt.key)}
              onChange={() => toggle(opt.key)}
            />
            <span>
              <span className="font-medium">{opt.label}</span>
              <span className="block text-xs text-muted">{opt.hint}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

export function ReportsClient({ view, isAdmin, users, selectedUserId, from, to, includeAcademic, summary, teamData }: Props) {
  const router = useRouter();

  function navigate(params: Record<string, string>) {
    const sp = new URLSearchParams({ user: selectedUserId, from, to, view, ...params });
    router.push(`/reports?${sp.toString()}`);
  }

  function applyPreset(days: number) {
    const end = new Date();
    const start = new Date(end.getTime() - days * 86400000);
    navigate({ from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) });
  }

  return (
    <div>
      <PageHeader
        title="Relatorios"
        description="Relatorios de atividades e painel de produtividade da equipe."
        actions={
          isAdmin ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => navigate({ view: "report" })}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${view === "report" ? "bg-brand text-white" : "text-muted hover:bg-surface2"}`}
              >
                <UserIcon size={14} className="mr-1 inline" />
                Individual
              </button>
              <button
                onClick={() => navigate({ view: "bi" })}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${view === "bi" ? "bg-brand text-white" : "text-muted hover:bg-surface2"}`}
              >
                <Users size={14} className="mr-1 inline" />
                Equipe
              </button>
            </div>
          ) : undefined
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        {isAdmin && view === "report" && (
          <Select value={selectedUserId} onChange={(e) => navigate({ user: e.target.value })}>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </Select>
        )}
        <div className="flex items-center gap-2">
          <Calendar size={14} className="text-muted" />
          <input
            type="date"
            value={from}
            onChange={(e) => navigate({ from: e.target.value })}
            className="rounded border border-border bg-surface px-2 py-1 text-sm"
          />
          <span className="text-muted">a</span>
          <input
            type="date"
            value={to}
            onChange={(e) => navigate({ to: e.target.value })}
            className="rounded border border-border bg-surface px-2 py-1 text-sm"
          />
        </div>
        <div className="flex gap-1">
          {PRESETS.map((p) => (
            <button
              key={p.days}
              onClick={() => applyPreset(p.days)}
              className="rounded border border-border px-2 py-1 text-xs text-muted hover:bg-surface2"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {view === "report" && summary && (
        <IndividualReport summary={summary} includeAcademic={includeAcademic} from={from} to={to} />
      )}

      {view === "bi" && teamData && (
        <TeamDashboard teamData={teamData} from={from} to={to} isAdmin={isAdmin} />
      )}
    </div>
  );
}

function IndividualReport({
  summary,
  includeAcademic,
  from,
  to,
}: {
  summary: UserActivitySummary;
  includeAcademic: boolean;
  from: string;
  to: string;
}) {
  const k = summary.kpis;
  const [copyMsg, setCopyMsg] = useState("");
  const [exportMsg, setExportMsg] = useState("");
  const [pending, start] = useTransition();
  const [aiSections, setAiSections] = useState<AiAnalysisSection[]>(DEFAULT_AI);

  async function copyMarkdown() {
    const r = await exportActivityReport({
      userId: summary.user.id,
      from,
      to,
      format: "markdown",
      aiSections,
    });
    if (r.markdown) {
      await navigator.clipboard.writeText(r.markdown);
      setCopyMsg("Copiado!");
      setTimeout(() => setCopyMsg(""), 2000);
    } else {
      const md = generateReportMarkdown(summary);
      await navigator.clipboard.writeText(md);
      setCopyMsg("Copiado!");
      setTimeout(() => setCopyMsg(""), 2000);
    }
  }

  function runExport(format: "pdf" | "markdown" | "both") {
    setExportMsg("");
    start(async () => {
      const r = await exportActivityReport({
        userId: summary.user.id,
        from,
        to,
        format,
        aiSections,
      });
      if (!r.ok) {
        setExportMsg(r.error ?? "Falha ao exportar");
        return;
      }
      if (r.pdfBase64 && r.filename) downloadPdfBase64(r.filename, r.pdfBase64);
      if (r.markdown && r.markdownFilename) downloadTextFile(r.markdownFilename, r.markdown);
      setExportMsg(
        r.aiUsed
          ? "Exportacao concluida (com analise IA)."
          : aiSections.length
            ? "Exportacao concluida (resumo factual — configure IA para analise rica)."
            : "Exportacao concluida.",
      );
      setTimeout(() => setExportMsg(""), 6000);
    });
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-4 p-4">
        <div>
          <h3 className="text-sm font-semibold">Exportar relatorio</h3>
          <p className="text-xs text-muted">
            Usa o periodo e a pessoa selecionados acima. Pode copiar Markdown, baixar .md e/ou PDF.
          </p>
        </div>
        <AiSectionsPicker selected={aiSections} onChange={setAiSections} />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => start(() => copyMarkdown())}
            disabled={pending}
            className="flex items-center gap-1 rounded border border-border px-3 py-1.5 text-sm hover:bg-surface2 disabled:opacity-60"
          >
            {pending ? <Loader2 size={14} className="animate-spin" /> : <Copy size={14} />}
            {copyMsg || "Copiar Markdown"}
          </button>
          <button
            type="button"
            onClick={() => runExport("markdown")}
            disabled={pending}
            className="flex items-center gap-1 rounded border border-border px-3 py-1.5 text-sm hover:bg-surface2 disabled:opacity-60"
          >
            <Download size={14} />
            Baixar .md
          </button>
          <button
            type="button"
            onClick={() => runExport("pdf")}
            disabled={pending}
            className="flex items-center gap-1 rounded border border-border px-3 py-1.5 text-sm hover:bg-surface2 disabled:opacity-60"
          >
            <FileText size={14} />
            Baixar PDF
          </button>
          <button
            type="button"
            onClick={() => runExport("both")}
            disabled={pending}
            className="flex items-center gap-1 rounded border border-border bg-brand/10 px-3 py-1.5 text-sm font-medium hover:bg-brand/15 disabled:opacity-60"
          >
            <Download size={14} />
            PDF + Markdown
          </button>
        </div>
        {exportMsg && <p className="text-xs text-muted">{exportMsg}</p>}
      </Card>

      <Card className="p-4">
        <h2 className="text-lg font-semibold">{summary.user.name}</h2>
        <p className="text-sm text-muted">
          {summary.user.profilesLabel} · {summary.user.email}
          {" · "}{formatDate(summary.period.from)} a {formatDate(summary.period.to)}
        </p>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard icon={<CheckCircle2 size={16} />} label="Tarefas concluidas" value={k.tasksCompleted} />
        <KpiCard icon={<ClipboardList size={16} />} label="Em andamento" value={k.tasksInProgress} />
        <KpiCard icon={<FileText size={16} />} label="Entregaveis" value={k.deliverablesSubmitted} />
        <KpiCard icon={<MessageSquare size={16} />} label="Posts/Topicos" value={k.forumPosts} />
      </div>

      {summary.tasksByProject.length > 0 && (
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold">Tarefas por projeto</h3>
          {summary.tasksByProject.map((proj) => (
            <div key={proj.projectId} className="mb-4 last:mb-0">
              <div className="mb-2 flex items-center gap-2">
                <Badge color={proj.projectColor}>{proj.projectKey}</Badge>
                <span className="text-sm font-medium">{proj.projectName}</span>
                <span className="text-xs text-muted">({proj.tasks.length} tarefas)</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted">
                      <th className="pb-1 pr-3">Tarefa</th>
                      <th className="pb-1 pr-3">Status</th>
                      <th className="pb-1 pr-3">Sprint</th>
                      <th className="pb-1">Prazo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {proj.tasks.map((t) => (
                      <tr key={t.id} className="border-b border-border/50">
                        <td className="py-1.5 pr-3">{t.title}</td>
                        <td className="py-1.5 pr-3"><StatusBadge status={t.status} /></td>
                        <td className="py-1.5 pr-3 text-muted">{t.sprintName ?? "-"}</td>
                        <td className="py-1.5 text-muted">{t.dueDate ? formatDate(t.dueDate) : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </Card>
      )}

      {summary.deliverables.length > 0 && (
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold">Entregaveis</h3>
          <div className="space-y-2">
            {summary.deliverables.map((d) => (
              <div key={d.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Badge color={d.projectColor}>{d.projectKey}</Badge>
                  <span>{d.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={d.status} />
                  {d.dueDate && <span className="text-xs text-muted">{formatDate(d.dueDate)}</span>}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {includeAcademic && summary.academic && (
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold">Perfil Academico</h3>
          <div className="grid gap-2 text-sm md:grid-cols-2">
            <div><span className="text-muted">Programa:</span> {summary.academic.program}</div>
            <div><span className="text-muted">Status:</span> {summary.academic.status}</div>
            <div><span className="text-muted">Orientador:</span> {summary.academic.advisorName ?? "N/I"}</div>
            <div>
              <span className="text-muted">Disciplinas:</span>{" "}
              {summary.academic.coursesDone}/{summary.academic.coursesTotal}
              <ProgressBar value={summary.academic.coursesTotal ? (summary.academic.coursesDone / summary.academic.coursesTotal) * 100 : 0} className="mt-1" />
            </div>
            {summary.academic.objective && (
              <div className="md:col-span-2">
                <span className="text-muted">Objetivo:</span> {summary.academic.objective}
              </div>
            )}
            <div><span className="text-muted">Pendencias:</span> {summary.academic.pendingCount}</div>
          </div>
        </Card>
      )}

      {Object.keys(summary.heatmap).length > 0 && (
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold">Mapa de atividade</h3>
          <ActivityHeatmap heatmap={summary.heatmap} from={summary.period.from} to={summary.period.to} />
        </Card>
      )}

      {summary.timeline.length > 0 && (
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold">Timeline</h3>
          <div className="space-y-2">
            {summary.timeline.map((ev) => (
              <div key={ev.id} className="flex items-center gap-3 text-sm">
                <Activity size={12} className="shrink-0 text-muted" />
                <span className="shrink-0 text-xs text-muted">{formatDate(ev.createdAt)}</span>
                <span>{ev.label}</span>
                {ev.projectKey && <Badge className="bg-surface2 text-muted text-xs">{ev.projectKey}</Badge>}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function TeamDashboard({
  teamData,
  from,
  to,
  isAdmin,
}: {
  teamData: TeamMemberOverview[];
  from: string;
  to: string;
  isAdmin: boolean;
}) {
  const [exportMsg, setExportMsg] = useState("");
  const [pending, start] = useTransition();
  const [aiSections, setAiSections] = useState<AiAnalysisSection[]>(DEFAULT_AI);

  const totals = useMemo(() => {
    let completed = 0, total = 0, events = 0, active = 0;
    teamData.forEach((m) => {
      completed += m.tasksCompleted;
      total += m.tasksTotal;
      events += m.totalEvents;
      if (m.totalEvents > 0) active += 1;
    });
    return { completed, total, events, active, members: teamData.length };
  }, [teamData]);

  const maxEvents = Math.max(...teamData.map((m) => m.totalEvents), 1);

  function runTeamExport(mode: "pdf" | "markdown" | "both" | "email" | "presentation") {
    setExportMsg("");
    start(async () => {
      if (mode === "presentation") {
        const r = await exportLabPresentation({ from, to, aiSections });
        if (!r.ok) {
          setExportMsg(r.error ?? "Falha ao gerar apresentacao");
        } else {
          if (r.pdfBase64 && r.filename) downloadPdfBase64(r.filename, r.pdfBase64);
          setExportMsg(
            r.aiUsed
              ? "Apresentacao gerada (com insights IA)."
              : "Apresentacao gerada.",
          );
        }
        setTimeout(() => setExportMsg(""), 7000);
        return;
      }

      const sendEmail = mode === "email";
      const format = mode === "email" ? "both" : mode;
      const r = await generateWeeklyReportNow({
        format,
        sendEmail,
        from,
        to,
        aiSections,
      });
      if (r.pdfBase64 && r.filename && (mode === "pdf" || mode === "both" || mode === "email")) {
        downloadPdfBase64(r.filename, r.pdfBase64);
      }
      if (r.markdown && r.markdownFilename && (mode === "markdown" || mode === "both" || mode === "email")) {
        downloadTextFile(r.markdownFilename, r.markdown);
      }
      if (!r.ok) setExportMsg(r.error ?? "Falha ao gerar");
      else if (sendEmail && r.emailed) setExportMsg(`Enviado para ${(r.recipients ?? []).length} admin(s).`);
      else if (sendEmail) setExportMsg(`Arquivos gerados. Email: ${r.error ?? "verifique SMTP"}.`);
      else setExportMsg(r.aiUsed ? "Exportacao concluida (com IA)." : "Exportacao concluida.");
      setTimeout(() => setExportMsg(""), 7000);
    });
  }

  return (
    <div className="space-y-6">
      {isAdmin && (
        <Card className="space-y-4 p-4">
          <div>
            <h3 className="text-sm font-semibold">Exportar relatorio da equipe</h3>
            <p className="text-xs text-muted">
              Usa o periodo selecionado ({formatDate(from)} a {formatDate(to)}): atividade, pendencias, projetos e analise IA.
              A apresentacao gera slides landscape (capa, insights, um slide por projeto e por integrante).
            </p>
          </div>
          <AiSectionsPicker selected={aiSections} onChange={setAiSections} />
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={pending} onClick={() => runTeamExport("markdown")} className="flex items-center gap-1 rounded border border-border px-3 py-1.5 text-sm hover:bg-surface2 disabled:opacity-60">
              <Download size={14} /> Baixar .md
            </button>
            <button type="button" disabled={pending} onClick={() => runTeamExport("pdf")} className="flex items-center gap-1 rounded border border-border px-3 py-1.5 text-sm hover:bg-surface2 disabled:opacity-60">
              <FileText size={14} /> Baixar PDF
            </button>
            <button type="button" disabled={pending} onClick={() => runTeamExport("presentation")} className="flex items-center gap-1 rounded border border-border bg-brand/10 px-3 py-1.5 text-sm font-medium hover:bg-brand/15 disabled:opacity-60">
              {pending ? <Loader2 size={14} className="animate-spin" /> : <Presentation size={14} />}
              Apresentacao PDF
            </button>
            <button type="button" disabled={pending} onClick={() => runTeamExport("both")} className="flex items-center gap-1 rounded border border-border px-3 py-1.5 text-sm hover:bg-surface2 disabled:opacity-60">
              <Download size={14} />
              PDF + Markdown
            </button>
            <button type="button" disabled={pending} onClick={() => runTeamExport("email")} className="flex items-center gap-1 rounded border border-border px-3 py-1.5 text-sm hover:bg-surface2 disabled:opacity-60">
              <Mail size={14} /> Enviar email
            </button>
          </div>
          {exportMsg && <p className="text-xs text-muted">{exportMsg}</p>}
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard icon={<Users size={16} />} label="Membros ativos" value={totals.active} />
        <KpiCard icon={<CheckCircle2 size={16} />} label="Tarefas concluidas" value={totals.completed} />
        <KpiCard icon={<BarChart3 size={16} />} label="Total de acoes" value={totals.events} />
        <KpiCard icon={<ClipboardList size={16} />} label="Tarefas totais" value={totals.total} />
      </div>

      <Card className="overflow-x-auto p-4">
        <h3 className="mb-3 text-sm font-semibold">Visao da equipe ({formatDate(from)} a {formatDate(to)})</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted">
              <th className="pb-2 pr-3">Membro</th>
              <th className="pb-2 pr-3">Papel</th>
              <th className="pb-2 pr-3">Tarefas</th>
              <th className="pb-2 pr-3">Progresso</th>
              <th className="pb-2 pr-3">Acoes</th>
              <th className="pb-2 pr-3">Atividade</th>
              <th className="pb-2">Ultimo evento</th>
            </tr>
          </thead>
          <tbody>
            {teamData.map((m) => {
              const pct = m.tasksTotal ? Math.round((m.tasksCompleted / m.tasksTotal) * 100) : 0;
              const actPct = Math.round((m.totalEvents / maxEvents) * 100);
              return (
                <tr key={m.id} className="border-b border-border/50">
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-2">
                      <Avatar name={m.name} color={m.avatarColor} size="sm" />
                      <span className="font-medium">{m.name}</span>
                    </div>
                  </td>
                  <td className="py-2 pr-3 text-muted">{m.profilesLabel}</td>
                  <td className="py-2 pr-3">
                    <span className="font-medium">{m.tasksCompleted}</span>
                    <span className="text-muted">/{m.tasksTotal}</span>
                  </td>
                  <td className="py-2 pr-3 min-w-[100px]"><ProgressBar value={pct} /></td>
                  <td className="py-2 pr-3">{m.totalEvents}</td>
                  <td className="py-2 pr-3 min-w-[80px]">
                    <div className="h-2 overflow-hidden rounded-full bg-surface2">
                      <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${actPct}%` }} />
                    </div>
                  </td>
                  <td className="py-2 text-xs text-muted">
                    {m.lastEventAt ? formatDate(m.lastEventAt) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card className="flex items-center gap-3 p-3">
      <div className="rounded-lg bg-surface2 p-2 text-muted">{icon}</div>
      <div>
        <p className="text-xs text-muted">{label}</p>
        <p className="text-xl font-semibold">{value}</p>
      </div>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    backlog: "#94a3b8",
    todo: "#3b82f6",
    in_progress: "#f59e0b",
    review: "#8b5cf6",
    done: "#22c55e",
    pending: "#94a3b8",
    submitted: "#3b82f6",
    accepted: "#22c55e",
    rejected: "#ef4444",
  };
  return <Badge color={colors[status] ?? "#64748b"}>{status}</Badge>;
}

function ProgressBar({ value, className = "" }: { value: number; className?: string }) {
  return (
    <div className={`h-1.5 overflow-hidden rounded-full bg-surface2 ${className}`}>
      <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

function ActivityHeatmap({
  heatmap,
  from,
  to,
}: {
  heatmap: Record<string, number>;
  from: string;
  to: string;
}) {
  const days: { key: string; count: number }[] = [];
  const start = new Date(from);
  const end = new Date(to);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    days.push({ key, count: heatmap[key] ?? 0 });
  }
  const max = Math.max(...days.map((d) => d.count), 1);

  return (
    <div className="flex flex-wrap gap-1">
      {days.map((d) => {
        const intensity = d.count / max;
        return (
          <div
            key={d.key}
            title={`${d.key}: ${d.count}`}
            className="h-3 w-3 rounded-sm"
            style={{
              backgroundColor: d.count === 0 ? "var(--surface2, #e2e8f0)" : `rgba(79, 70, 229, ${0.2 + intensity * 0.8})`,
            }}
          />
        );
      })}
    </div>
  );
}
