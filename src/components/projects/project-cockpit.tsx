import Link from "next/link";
import { Card, Badge } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { BookOpen, MessageSquare, PackageCheck, ListTodo, Zap, Cpu, ShieldCheck, TrendingUp } from "lucide-react";

type ProjectProgress = {
  progressPct: number;
  doneTasks: number;
  totalTasks: number;
  doneWeight: number;
  totalWeight: number;
  unmappedTasks: number;
};

type CockpitProps = {
  project: { id: string; key: string; name: string; color: string };
  activeSprint: { id: string; name: string; goal: string | null; endDate: string | null } | null;
  openTasks: number;
  projectProgress?: ProjectProgress;
  deliverables: { id: string; name: string; status: string; dueDate: string | null }[];
  articles: { id: string; title: string; externalSource: string | null; updatedAt: string }[];
  threads: { id: string; title: string; status: string; updatedAt: string }[];
  linkCount: number;
  seMaturity?: { approved: number; total: number };
  vvPassed?: number;
  vvTotal?: number;
  systemElementCount?: number;
};

const DELIV_STATUS: Record<string, string> = {
  pending: "Pendente",
  in_progress: "Em andamento",
  submitted: "Submetido",
};

export function ProjectCockpit({
  project,
  activeSprint,
  openTasks,
  projectProgress,
  deliverables,
  articles,
  threads,
  linkCount,
  seMaturity,
  vvPassed = 0,
  vvTotal = 0,
  systemElementCount = 0,
}: CockpitProps) {
  return (
    <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Card className="p-4">
        <div className="mb-2 flex items-center gap-2 text-muted">
          <Zap size={15} />
          <span className="text-xs font-semibold uppercase tracking-wide">Sprint</span>
        </div>
        {activeSprint ? (
          <>
            <p className="font-medium">{activeSprint.name}</p>
            {activeSprint.goal && <p className="mt-1 line-clamp-2 text-xs text-muted">{activeSprint.goal}</p>}
            {activeSprint.endDate && (
              <p className="mt-2 text-xs text-muted">Ate {formatDate(activeSprint.endDate)}</p>
            )}
            <Link href="/sprints" className="mt-2 inline-block text-xs text-brand hover:underline">
              Ver sprints
            </Link>
          </>
        ) : (
          <p className="text-sm text-muted">Nenhuma sprint ativa.</p>
        )}
      </Card>

      <Card className="p-4">
        <div className="mb-2 flex items-center gap-2 text-muted">
          <TrendingUp size={15} />
          <span className="text-xs font-semibold uppercase tracking-wide">Progresso</span>
        </div>
        {projectProgress && projectProgress.totalTasks > 0 ? (
          <>
            <p className="text-2xl font-semibold">{projectProgress.progressPct}%</p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface2">
              <div
                className="h-full rounded-full bg-brand transition-all"
                style={{ width: `${projectProgress.progressPct}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-muted">
              {projectProgress.doneTasks}/{projectProgress.totalTasks} tarefas
              {projectProgress.totalWeight > 0 && (
                <> · {Math.round(projectProgress.doneWeight)}h/{Math.round(projectProgress.totalWeight)}h</>
              )}
            </p>
            {projectProgress.unmappedTasks > 0 && (
              <p className="mt-1 text-xs text-amber-500">
                {projectProgress.unmappedTasks} tarefa(s) sem WBS
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-muted">Sem tarefas no projeto.</p>
        )}
        <Link href={`/projects/${project.id}?tab=tasks`} className="mt-2 inline-block text-xs text-brand hover:underline">
          Ver tarefas
        </Link>
      </Card>

      <Card className="p-4">
        <div className="mb-2 flex items-center gap-2 text-muted">
          <ListTodo size={15} />
          <span className="text-xs font-semibold uppercase tracking-wide">Trabalho</span>
        </div>
        <p className="text-2xl font-semibold">{openTasks}</p>
        <p className="text-xs text-muted">tarefas abertas</p>
        <p className="mt-1 text-xs text-muted">{linkCount} vinculo(s) com conhecimento</p>
        <Link href={`/board?project=${project.id}`} className="mt-2 inline-block text-xs text-brand hover:underline">
          Abrir Kanban
        </Link>
      </Card>

      <Card className="p-4">
        <div className="mb-2 flex items-center gap-2 text-muted">
          <PackageCheck size={15} />
          <span className="text-xs font-semibold uppercase tracking-wide">Entregaveis</span>
        </div>
        {deliverables.length === 0 ? (
          <p className="text-sm text-muted">Nenhum entregavel aberto.</p>
        ) : (
          <ul className="space-y-1.5">
            {deliverables.slice(0, 4).map((d) => (
              <li key={d.id} className="text-xs">
                <span className="font-medium">{d.name}</span>
                <span className="ml-1 text-muted">· {DELIV_STATUS[d.status] ?? d.status}</span>
              </li>
            ))}
          </ul>
        )}
        <Link href="/deliverables" className="mt-2 inline-block text-xs text-brand hover:underline">
          Ver todos
        </Link>
      </Card>

      <Card className="p-4">
        <div className="mb-2 flex items-center gap-2 text-muted">
          <BookOpen size={15} />
          <span className="text-xs font-semibold uppercase tracking-wide">Conhecimento</span>
        </div>
        {articles.length === 0 ? (
          <p className="text-sm text-muted">Nenhum artigo do projeto.</p>
        ) : (
          <ul className="space-y-1.5">
            {articles.slice(0, 4).map((a) => (
              <li key={a.id}>
                <Link href={`/knowledge/${a.id}`} className="text-xs hover:text-brand">
                  {a.title}
                  {a.externalSource === "nextcloud" && (
                    <Badge className="ml-1 bg-surface2 text-[10px] text-muted">NC</Badge>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Link href="/knowledge" className="mt-2 inline-block text-xs text-brand hover:underline">
          Base de conhecimento
        </Link>
      </Card>

      <Card className="p-4">
        <div className="mb-2 flex items-center gap-2 text-muted">
          <Cpu size={15} />
          <span className="text-xs font-semibold uppercase tracking-wide">Modelo SE</span>
        </div>
        <p className="text-2xl font-semibold">{systemElementCount}</p>
        <p className="text-xs text-muted">elementos do sistema</p>
        {seMaturity && (
          <p className="mt-1 text-xs text-muted">Maturidade: {seMaturity.approved}/{seMaturity.total} requisitos aprovados</p>
        )}
        <Link href="/system-model" className="mt-2 inline-block text-xs text-brand hover:underline">Abrir modelo</Link>
      </Card>

      <Card className="p-4">
        <div className="mb-2 flex items-center gap-2 text-muted">
          <ShieldCheck size={15} />
          <span className="text-xs font-semibold uppercase tracking-wide">V&V</span>
        </div>
        <p className="text-2xl font-semibold">{vvPassed}/{vvTotal}</p>
        <p className="text-xs text-muted">casos aprovados</p>
        <Link href="/verification" className="mt-2 inline-block text-xs text-brand hover:underline">Matriz V&V</Link>
      </Card>

      {threads.length > 0 && (
        <Card className="p-4 md:col-span-2">
          <div className="mb-2 flex items-center gap-2 text-muted">
            <MessageSquare size={15} />
            <span className="text-xs font-semibold uppercase tracking-wide">Forum recente</span>
          </div>
          <ul className="space-y-1.5">
            {threads.slice(0, 5).map((t) => (
              <li key={t.id}>
                <Link href={`/forum/${t.id}`} className="text-sm hover:text-brand">
                  {t.title}
                </Link>
                <span className="ml-2 text-xs text-muted">{t.status}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
