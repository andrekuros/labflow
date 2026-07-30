"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Download, Upload, FileText } from "lucide-react";
import { Card, Button, Input, Textarea, Select, Label, Avatar } from "@/components/ui";
import {
  updateProject,
  saveProjectBoardSettings,
  updateMemberRole,
  removeMember,
  deleteProject,
  updateProjectFeatures,
} from "@/plugins/projects/actions";
import {
  exportProjectBundleAction,
  getProjectBundleFormatDocAction,
} from "@/app/actions/data-transfer";
import { AddMemberForm } from "@/components/projects/project-forms";
import {
  PROJECT_FEATURES,
  PROJECT_FEATURE_LABELS,
  type ProjectFeatures,
} from "@/lib/projects/features";
import { memberRolesForKind, PROJECT_MEMBER_ROLE_LABELS } from "@/lib/projects/membership-roles";

const STATUS_LABELS: Record<string, string> = {
  active: "Ativo",
  paused: "Pausado",
  archived: "Arquivado",
};

const ROLE_LABELS: Record<string, string> = {
  lead: "Lider",
  contributor: "Contribuidor",
  viewer: "Leitor",
  advisor: "Orientador",
  coauthor: "Coautor",
};

type MemberRow = {
  id: string;
  userId: string;
  userName: string;
  userProfilesLabel: string;
  avatarColor: string;
  role: string;
};

export function ProjectSettingsPanel({
  project,
  members,
  memberCandidates,
  boardColumns,
  canAssignLead,
  features: initialFeatures,
  projectBundleFormatDocId,
}: {
  project: {
    id: string;
    key: string;
    name: string;
    description: string | null;
    color: string;
    status: string;
    kind?: string;
  };
  members: MemberRow[];
  memberCandidates: { id: string; name: string }[];
  boardColumns: string[];
  canAssignLead: boolean;
  features: ProjectFeatures;
  projectBundleFormatDocId?: string | null;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [importJson, setImportJson] = useState("");

  const [key, setKey] = useState(project.key);
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  const [color, setColor] = useState(project.color);
  const [status, setStatus] = useState(project.status);
  const [columns, setColumns] = useState(JSON.stringify(boardColumns, null, 2));
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [features, setFeatures] = useState(initialFeatures);
  const memberRoles = memberRolesForKind(project.kind ?? "lab", canAssignLead);

  function saveFeatures() {
    start(async () => {
      setError("");
      const res = await updateProjectFeatures(project.id, features);
      if (res.error) setError(res.error);
      else {
        setInfo("Modulos do projeto salvos.");
        router.refresh();
      }
    });
  }

  function saveGeneral() {
    start(async () => {
      setError("");
      setInfo("");
      try {
        await updateProject(project.id, { key, name, description, color, status });
        setInfo("Dados do projeto salvos.");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao salvar");
      }
    });
  }

  function saveBoard() {
    start(async () => {
      setError("");
      setInfo("");
      try {
        const parsed = JSON.parse(columns);
        await saveProjectBoardSettings(project.id, parsed);
        setInfo("Colunas do Kanban salvas.");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "JSON invalido nas colunas");
      }
    });
  }

  function handleDelete() {
    if (!confirm(`Excluir permanentemente o projeto "${project.name}"? Esta acao nao pode ser desfeita.`)) {
      return;
    }
    start(async () => {
      setError("");
      try {
        await deleteProject(project.id, deleteConfirm);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao excluir");
      }
    });
  }

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-red-500">{error}</p>}
      {info && <p className="text-sm text-brand">{info}</p>}

      <Card className="p-5">
        <h2 className="mb-1 text-sm font-semibold">Dados do projeto</h2>
        <p className="mb-4 text-xs text-muted">Sigla, nome, descricao, cor e status do projeto.</p>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Sigla</Label>
            <Input value={key} onChange={(e) => setKey(e.target.value.toUpperCase())} maxLength={8} />
          </div>
          <div>
            <Label>Status</Label>
            <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full">
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label>Descricao</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div>
            <Label>Cor</Label>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-9 w-16 rounded-lg border border-border bg-surface2"
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button size="sm" disabled={pending || !key.trim() || !name.trim()} onClick={saveGeneral}>
            Salvar dados
          </Button>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="mb-1 text-sm font-semibold">Modulos do projeto</h2>
        <p className="mb-4 text-xs text-muted">
          Ative ou desative recursos (WBS, requisitos, metodologia, etc.) para este projeto.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {PROJECT_FEATURES.map((f) => (
            <label key={f} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={features[f]}
                onChange={(e) => setFeatures({ ...features, [f]: e.target.checked })}
              />
              {PROJECT_FEATURE_LABELS[f]}
            </label>
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <Button size="sm" disabled={pending} onClick={saveFeatures}>
            Salvar modulos
          </Button>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="mb-1 text-sm font-semibold">Kanban</h2>
        <p className="mb-4 text-xs text-muted">Colunas do quadro para este projeto (override do plugin board).</p>
        <Textarea
          value={columns}
          onChange={(e) => setColumns(e.target.value)}
          rows={4}
          className="font-mono text-xs"
        />
        <div className="mt-4 flex justify-end">
          <Button size="sm" disabled={pending} onClick={saveBoard}>
            Salvar colunas
          </Button>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="mb-1 text-sm font-semibold">Equipe do projeto</h2>
        <p className="mb-4 text-xs text-muted">
          Gerencie membros e papeis. {canAssignLead ? "Administradores podem designar lideres." : "Somente administradores podem designar lider do projeto."}
        </p>
        <div className="mb-4 space-y-2">
          {members.map((m) => (
            <div key={m.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3">
              <Avatar name={m.userName} color={m.avatarColor} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{m.userName}</p>
                <p className="text-xs text-muted">{m.userProfilesLabel}</p>
              </div>
              <Select
                value={m.role}
                disabled={pending}
                onChange={(e) =>
                  start(async () => {
                    setError("");
                    try {
                      await updateMemberRole(m.id, e.target.value);
                      router.refresh();
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Erro");
                    }
                  })
                }
                className="w-36"
              >
                {memberRoles.map((r) => (
                  <option key={r} value={r}>{PROJECT_MEMBER_ROLE_LABELS[r]}</option>
                ))}
                {m.role === "lead" && !canAssignLead && !memberRoles.includes("lead") && (
                  <option value="lead">Lider</option>
                )}
                {!(memberRoles as string[]).includes(m.role) && m.role !== "lead" && (
                  <option value={m.role}>{ROLE_LABELS[m.role] ?? m.role}</option>
                )}
              </Select>
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    if (!confirm(`Remover ${m.userName} do projeto?`)) return;
                    setError("");
                    try {
                      await removeMember(m.id);
                      router.refresh();
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Erro");
                    }
                  })
                }
              >
                <Trash2 size={14} />
              </Button>
            </div>
          ))}
        </div>
        <AddMemberForm
          projectId={project.id}
          candidates={memberCandidates}
          canAssignLead={canAssignLead}
          projectKind={project.kind ?? "lab"}
        />
      </Card>

      <Card className="p-5">
        <h2 className="mb-1 text-sm font-semibold">Exportar / importar projeto completo</h2>
        <p className="mb-4 text-xs text-muted">
          Pacote JSON com todos os dados do projeto (tarefas, requisitos, wiki, forum, etc.) para migrar a outro servidor LabFlow
          ou enviar a uma IA externa para criar / complementar o projeto. Usuarios referenciados devem existir no destino
          (importe-os antes).
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() =>
              start(async () => {
                setError("");
                try {
                  const text = await exportProjectBundleAction(project.id);
                  const blob = new Blob([text], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `labflow-project-${project.key.toLowerCase()}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                  setInfo("Pacote do projeto exportado.");
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Erro ao exportar");
                }
              })
            }
          >
            <Download size={14} /> Baixar pacote completo
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() =>
              start(async () => {
                setError("");
                try {
                  const text = await getProjectBundleFormatDocAction();
                  const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "labflow-formato-projeto-v1.md";
                  a.click();
                  URL.revokeObjectURL(url);
                  setInfo("Guia do formato baixado.");
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Erro ao baixar guia");
                }
              })
            }
          >
            <FileText size={14} /> Baixar guia do formato (MD)
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => setImportJson(String(reader.result ?? ""));
              reader.readAsText(file);
              e.target.value = "";
            }}
          />
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload size={14} /> Carregar arquivo
          </Button>
        </div>
        {projectBundleFormatDocId && (
          <p className="mt-2 text-xs text-muted">
            Documentacao tambem na base de conhecimento:{" "}
            <a href={`/knowledge/${projectBundleFormatDocId}`} className="text-brand hover:underline">
              Formato JSON de projeto LabFlow
            </a>
          </p>
        )}
        <p className="mt-3 text-xs text-muted">
          Importacao abaixo e apenas para administradores em Configuracoes. Aqui voce pode preparar o JSON para enviar ao admin do servidor destino.
        </p>
        <div className="mt-3 space-y-2">
          <Label>Visualizar / validar JSON exportado</Label>
          <Textarea
            value={importJson}
            onChange={(e) => setImportJson(e.target.value)}
            rows={4}
            className="font-mono text-xs"
            placeholder='{"version":"1.0","kind":"project",...}'
          />
        </div>
      </Card>

      <Card className="border-red-500/30 p-5">
        <h2 className="mb-1 text-sm font-semibold text-red-500">Zona de perigo</h2>
        <p className="mb-4 text-xs text-muted">
          Exclui o projeto e todos os dados vinculados (tarefas, requisitos, entregaveis, etc.). Digite a sigla{" "}
          <span className="font-mono font-medium text-fg">{project.key}</span> para confirmar.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[160px] flex-1">
            <Label>Confirmar sigla</Label>
            <Input
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value.toUpperCase())}
              placeholder={project.key}
            />
          </div>
          <Button
            variant="danger"
            size="sm"
            disabled={pending || deleteConfirm !== project.key}
            onClick={handleDelete}
          >
            <Trash2 size={14} /> Excluir projeto
          </Button>
        </div>
      </Card>
    </div>
  );
}
