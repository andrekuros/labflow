"use client";

import { useState, useTransition } from "react";
import { Card, Badge, Button, PageHeader } from "@/components/ui";
import {
  togglePluginAction,
  savePluginSettingsAction,
  savePluginProjectSettingsAction,
  createApiKeyAction,
  deleteApiKeyAction,
  saveAiSettingsAction,
} from "@/app/actions/settings";
import {
  syncNextcloudAction,
  testNextcloudAction,
  saveNextcloudSettingsAction,
  createNextcloudTemplateAction,
  getKnowledgeHealthAction,
} from "@/plugins/knowledge/actions";
import { TEMPLATE_CATALOG, type TemplateKey } from "@/plugins/knowledge/templates-catalog";
import type { SettingsField } from "@/plugins/types";

type PluginRow = {
  id: string;
  name: string;
  description: string;
  version: string;
  enabled: boolean;
  settings: Record<string, unknown>;
  settingsSchema: SettingsField[];
  requires: string[];
};

type ApiKeyRow = {
  id: string;
  name: string;
  createdAt: string;
  lastUsed: string | null;
  userName: string;
};

type ProjectRow = { id: string; key: string; name: string };

type AiSettingsRow = {
  aiProvider: string;
  aiApiKey: string;
  aiBaseUrl: string;
  aiChatModel: string;
  aiEmbeddingModel: string;
  hasStoredKey: boolean;
  configSource: string;
};

type NextcloudSettingsRow = {
  enabled: boolean;
  url: string;
  username: string;
  appPassword: string;
  folder: string;
  autoSyncEnabled: boolean;
  autoSyncIntervalMinutes: number;
  folderProjectMapJson: string;
  excludeFoldersText: string;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  lastSyncMessage: string | null;
  lastSyncCount: number;
  hasStoredPassword: boolean;
};

export function SettingsClient({
  plugins,
  apiKeys,
  projects,
  aiSettings,
  nextcloudSettings,
}: {
  plugins: PluginRow[];
  apiKeys: ApiKeyRow[];
  projects: ProjectRow[];
  aiSettings: AiSettingsRow;
  nextcloudSettings: NextcloudSettingsRow;
}) {
  const [pending, start] = useTransition();
  const [newKey, setNewKey] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Record<string, unknown>>>(
    Object.fromEntries(plugins.map((p) => [p.id, { ...p.settings }])),
  );

  return (
    <div>
      <PageHeader
        title="Configuracoes"
        description="Gerencie modulos, preferencias por plugin e chaves de API para integracoes."
      />

      <AiProviderForm initial={aiSettings} disabled={pending} onSave={(data) => start(() => saveAiSettingsAction(data))} />

      <NextcloudForm
        initial={nextcloudSettings}
        disabled={pending}
        onSave={(data) => start(() => saveNextcloudSettingsAction(data))}
        onTest={(data) => testNextcloudAction(data)}
        onSync={() => syncNextcloudAction()}
      />

      <div className="space-y-4">
        {plugins.map((p) => (
          <Card key={p.id} className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{p.name}</h3>
                  <Badge className="bg-surface2 text-muted">v{p.version}</Badge>
                  {p.requires.length > 0 && (
                    <Badge className="bg-surface2 text-muted">requer: {p.requires.join(", ")}</Badge>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted">{p.description}</p>
                <p className="mt-1 font-mono text-[11px] text-muted">{p.id}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge color={p.enabled ? "#22c55e" : "#64748b"}>{p.enabled ? "Ativo" : "Desativado"}</Badge>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => start(() => togglePluginAction(p.id, !p.enabled))}
                >
                  {p.enabled ? "Desativar" : "Ativar"}
                </Button>
                {p.settingsSchema.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setExpanded(expanded === p.id ? null : p.id)}
                  >
                    Configurar
                  </Button>
                )}
              </div>
            </div>

            {expanded === p.id && p.settingsSchema.length > 0 && (
              <form
                className="mt-4 space-y-3 border-t border-border pt-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  start(() => savePluginSettingsAction(p.id, drafts[p.id] ?? {}));
                }}
              >
                {p.settingsSchema.map((field) => (
                  <SettingsFieldInput
                    key={field.key}
                    field={field}
                    value={drafts[p.id]?.[field.key]}
                    onChange={(val) =>
                      setDrafts((d) => ({ ...d, [p.id]: { ...d[p.id], [field.key]: val } }))
                    }
                  />
                ))}
                <Button type="submit" size="sm" disabled={pending}>Salvar configuracoes</Button>
              </form>
            )}
          </Card>
        ))}
      </div>

      {projects.length > 0 && (
        <Card className="mt-8 p-5">
          <h2 className="mb-2 text-sm font-semibold">Configuracoes por projeto</h2>
          <p className="mb-4 text-sm text-muted">
            Overrides por projeto para plugins que suportam configuracao contextual (ex: colunas do Kanban).
          </p>
          <ProjectSettingsForm projects={projects} />
        </Card>
      )}

      <Card className="mt-8 p-5">
        <h2 className="mb-2 text-sm font-semibold">Chaves de API</h2>
        <p className="mb-4 text-sm text-muted">
          Use no header <span className="font-mono text-xs">Authorization: Bearer lf_...</span> para integrar com a API REST.
        </p>

        {newKey && (
          <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            <p className="font-medium">Chave criada (copie agora, nao sera exibida novamente):</p>
            <code className="mt-1 block break-all font-mono text-xs">{newKey}</code>
          </div>
        )}

        <div className="mb-4 space-y-2">
          {apiKeys.map((k) => (
            <div key={k.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
              <div>
                <p className="font-medium">{k.name}</p>
                <p className="text-xs text-muted">
                  Criada {new Date(k.createdAt).toLocaleString("pt-BR")}
                  {k.lastUsed ? ` · Ultimo uso ${new Date(k.lastUsed).toLocaleString("pt-BR")}` : ""}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => start(() => deleteApiKeyAction(k.id))}
              >
                Revogar
              </Button>
            </div>
          ))}
          {apiKeys.length === 0 && <p className="text-sm text-muted">Nenhuma chave criada.</p>}
        </div>

        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const key = await createApiKeyAction(`integracao-${Date.now()}`);
              setNewKey(key);
            })
          }
        >
          Gerar nova chave
        </Button>
      </Card>

      <Card className="mt-8 p-5">
        <h2 className="mb-2 text-sm font-semibold">Backup</h2>
        <p className="mb-4 text-sm text-muted">
          Exporta o banco SQLite e as configuracoes dos plugins em um arquivo <span className="font-mono text-xs">.tar.gz</span>.
        </p>
        <a href="/api/admin/backup" className="inline-flex">
          <Button size="sm" variant="outline">Baixar backup</Button>
        </a>
      </Card>
    </div>
  );
}

function AiProviderForm({
  initial,
  disabled,
  onSave,
}: {
  initial: AiSettingsRow;
  disabled: boolean;
  onSave: (data: {
    aiProvider: string;
    aiApiKey?: string;
    aiBaseUrl?: string;
    aiChatModel?: string;
    aiEmbeddingModel?: string;
  }) => void;
}) {
  const [provider, setProvider] = useState(initial.aiProvider);
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState(initial.aiBaseUrl);
  const [chatModel, setChatModel] = useState(initial.aiChatModel);
  const [embeddingModel, setEmbeddingModel] = useState(initial.aiEmbeddingModel);

  return (
    <Card className="mb-8 p-5">
      <h2 className="mb-1 text-sm font-semibold">Assistente de IA — Provedor LLM</h2>
      <p className="mb-4 text-sm text-muted">
        Configure o modelo usado em <span className="font-mono text-xs">/assistant</span>.
        {initial.configSource === "env" && " Valores do .env em uso ate salvar aqui."}
        {initial.hasStoredKey && " Chave de API ja configurada."}
      </p>

      <form
        className="grid gap-4 md:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          onSave({
            aiProvider: provider,
            aiApiKey: apiKey || undefined,
            aiBaseUrl: baseUrl,
            aiChatModel: chatModel,
            aiEmbeddingModel: embeddingModel,
          });
          setApiKey("");
        }}
      >
        <div>
          <label className="mb-1 block text-xs font-medium text-muted" htmlFor="ai-provider">Provedor</label>
          <select
            id="ai-provider"
            className="h-9 w-full rounded-lg border border-border bg-surface2 px-3 text-sm"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
          >
            <option value="none">Offline (sem LLM)</option>
            <option value="openai">OpenAI / API compativel</option>
            <option value="ollama">Ollama (local)</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted" htmlFor="ai-api-key">
            Chave de API {provider === "openai" ? "(obrigatoria)" : "(opcional)"}
          </label>
          <input
            id="ai-api-key"
            type="password"
            className="h-9 w-full rounded-lg border border-border bg-surface2 px-3 text-sm"
            placeholder={initial.hasStoredKey ? "••••••••  (deixe vazio para manter)" : "sk-..."}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            autoComplete="off"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted" htmlFor="ai-base-url">URL base</label>
          <input
            id="ai-base-url"
            type="text"
            className="h-9 w-full rounded-lg border border-border bg-surface2 px-3 text-sm"
            placeholder={provider === "ollama" ? "http://127.0.0.1:11434" : "https://api.openai.com/v1"}
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted" htmlFor="ai-chat-model">Modelo de chat</label>
          <input
            id="ai-chat-model"
            type="text"
            className="h-9 w-full rounded-lg border border-border bg-surface2 px-3 text-sm"
            placeholder={provider === "ollama" ? "qwen2.5-coder:14b" : "gpt-4o-mini"}
            value={chatModel}
            onChange={(e) => setChatModel(e.target.value)}
          />
        </div>

        <div className="md:col-span-2">
          <label className="mb-1 block text-xs font-medium text-muted" htmlFor="ai-embed-model">Modelo de embeddings</label>
          <input
            id="ai-embed-model"
            type="text"
            className="h-9 w-full rounded-lg border border-border bg-surface2 px-3 text-sm"
            placeholder="text-embedding-3-small"
            value={embeddingModel}
            onChange={(e) => setEmbeddingModel(e.target.value)}
          />
          <p className="mt-1 text-xs text-muted">Usado com OpenAI. Ollama usa embeddings locais automaticamente.</p>
        </div>

        <div className="md:col-span-2">
          <Button type="submit" size="sm" disabled={disabled}>Salvar configuracao de IA</Button>
        </div>
      </form>
    </Card>
  );
}

function NextcloudForm({
  initial,
  disabled,
  onSave,
  onTest,
  onSync,
}: {
  initial: NextcloudSettingsRow;
  disabled: boolean;
  onSave: (data: {
    nextcloudEnabled: boolean;
    nextcloudUrl: string;
    nextcloudUsername: string;
    nextcloudAppPassword?: string;
    nextcloudFolder: string;
    nextcloudAutoSyncEnabled?: boolean;
    nextcloudAutoSyncIntervalMinutes?: number;
    nextcloudFolderProjectMapJson?: string;
    nextcloudExcludeFolders?: string;
  }) => void;
  onTest: (data: {
    nextcloudUrl: string;
    nextcloudUsername: string;
    nextcloudAppPassword?: string;
    nextcloudFolder: string;
  }) => Promise<{ ok: boolean; message: string }>;
  onSync: () => Promise<{ ok: boolean; message: string }>;
}) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [url, setUrl] = useState(initial.url);
  const [username, setUsername] = useState(initial.username);
  const [password, setPassword] = useState("");
  const [folder, setFolder] = useState(initial.folder || "LabFlow");
  const [autoSync, setAutoSync] = useState(initial.autoSyncEnabled);
  const [autoSyncMinutes, setAutoSyncMinutes] = useState(initial.autoSyncIntervalMinutes || 60);
  const [folderMapJson, setFolderMapJson] = useState(
    initial.folderProjectMapJson || '{\n  "projetos/EEG": "EEG"\n}',
  );
  const [excludeFolders, setExcludeFolders] = useState(initial.excludeFoldersText || "templates");
  const [testResult, setTestResult] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [healthSummary, setHealthSummary] = useState<string | null>(null);
  const [templateMsg, setTemplateMsg] = useState<string | null>(null);

  const payload = () => ({
    nextcloudUrl: url,
    nextcloudUsername: username,
    nextcloudAppPassword: password || undefined,
    nextcloudFolder: folder,
    nextcloudAutoSyncEnabled: autoSync,
    nextcloudAutoSyncIntervalMinutes: autoSyncMinutes,
    nextcloudFolderProjectMapJson: folderMapJson,
    nextcloudExcludeFolders: excludeFolders,
  });

  return (
    <Card className="mb-8 p-5">
      <h2 className="mb-1 text-sm font-semibold">Nextcloud — Base de conhecimento</h2>
      <p className="mb-4 text-sm text-muted">
        Sincronize arquivos <span className="font-mono text-xs">.md</span> e <span className="font-mono text-xs">.txt</span> do Nextcloud para o LabFlow e indexe no RAG automaticamente.
      </p>

      {initial.lastSyncAt && (
        <p className="mb-4 text-xs text-muted">
          Ultimo sync: {new Date(initial.lastSyncAt).toLocaleString("pt-BR")}
          {initial.lastSyncMessage ? ` — ${initial.lastSyncMessage}` : ""}
        </p>
      )}

      <form
        className="grid gap-4 md:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          onSave({ nextcloudEnabled: enabled, ...payload() });
          setPassword("");
        }}
      >
        <label className="flex items-center gap-2 text-sm md:col-span-2">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Habilitar sincronizacao com Nextcloud
        </label>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted" htmlFor="nc-url">URL do Nextcloud</label>
          <input
            id="nc-url"
            type="text"
            className="h-9 w-full rounded-lg border border-border bg-surface2 px-3 text-sm"
            placeholder="https://cloud.conceptio.com.br"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted" htmlFor="nc-user">Usuario</label>
          <input
            id="nc-user"
            type="text"
            className="h-9 w-full rounded-lg border border-border bg-surface2 px-3 text-sm"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted" htmlFor="nc-pass">Senha de app</label>
          <input
            id="nc-pass"
            type="password"
            className="h-9 w-full rounded-lg border border-border bg-surface2 px-3 text-sm"
            placeholder={initial.hasStoredPassword ? "••••••••  (deixe vazio para manter)" : "Senha de app"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="off"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted" htmlFor="nc-folder">Pasta</label>
          <input
            id="nc-folder"
            type="text"
            className="h-9 w-full rounded-lg border border-border bg-surface2 px-3 text-sm"
            placeholder="LabFlow"
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
          />
        </div>

        <label className="flex items-center gap-2 text-sm md:col-span-2">
          <input type="checkbox" checked={autoSync} onChange={(e) => setAutoSync(e.target.checked)} />
          Sync automatico (verifica a cada minuto)
        </label>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted" htmlFor="nc-interval">Intervalo (minutos)</label>
          <input
            id="nc-interval"
            type="number"
            min={5}
            className="h-9 w-full rounded-lg border border-border bg-surface2 px-3 text-sm"
            value={autoSyncMinutes}
            onChange={(e) => setAutoSyncMinutes(Number(e.target.value))}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted" htmlFor="nc-exclude">Pastas excluidas</label>
          <input
            id="nc-exclude"
            type="text"
            className="h-9 w-full rounded-lg border border-border bg-surface2 px-3 text-sm"
            placeholder="templates, rascunhos"
            value={excludeFolders}
            onChange={(e) => setExcludeFolders(e.target.value)}
          />
        </div>

        <div className="md:col-span-2">
          <label className="mb-1 block text-xs font-medium text-muted" htmlFor="nc-map">Mapeamento pasta → projeto (JSON)</label>
          <textarea
            id="nc-map"
            rows={5}
            className="w-full rounded-lg border border-border bg-surface2 px-3 py-2 font-mono text-xs"
            value={folderMapJson}
            onChange={(e) => setFolderMapJson(e.target.value)}
            placeholder='{"projetos/EEG": "EEG", "equipamentos": ""}'
          />
          <p className="mt-1 text-xs text-muted">Chave = pasta no vault. Valor = key do projeto no LabFlow (ex: EEG).</p>
        </div>

        <div className="flex flex-wrap gap-2 md:col-span-2">
          <Button type="submit" size="sm" disabled={disabled}>Salvar</Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={async () => {
              const r = await onTest(payload());
              setTestResult(r.ok ? `OK: ${r.message}` : `Erro: ${r.message}`);
            }}
          >
            Testar conexao
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || !enabled}
            onClick={async () => {
              const r = await onSync();
              setSyncResult(r.ok ? r.message : `Erro: ${r.message}`);
            }}
          >
            Sincronizar agora
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || !enabled}
            onClick={async () => {
              const h = await getKnowledgeHealthAction();
              const s = h.summary;
              setHealthSummary(
                `${s.missingTitle} sem titulo, ${s.noProject} sem projeto, ${s.stale} desatualizados, ${s.emptyFolders} pastas vazias`,
              );
            }}
          >
            Ver saude
          </Button>
        </div>

        <div className="md:col-span-2">
          <p className="mb-2 text-xs font-medium text-muted">Templates no Nextcloud</p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(TEMPLATE_CATALOG) as TemplateKey[]).map((key) => (
              <Button
                key={key}
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled || !enabled}
                onClick={async () => {
                  const r = await createNextcloudTemplateAction({
                    templateKey: key,
                    targetFolder: "templates",
                    title: TEMPLATE_CATALOG[key].label,
                  });
                  setTemplateMsg(r.message);
                }}
              >
                {TEMPLATE_CATALOG[key].label}
              </Button>
            ))}
          </div>
        </div>

        {testResult && <p className="text-xs text-muted md:col-span-2">{testResult}</p>}
        {syncResult && <p className="text-xs text-muted md:col-span-2">{syncResult}</p>}
        {healthSummary && <p className="text-xs text-muted md:col-span-2">Saude: {healthSummary}</p>}
        {templateMsg && <p className="text-xs text-muted md:col-span-2">{templateMsg}</p>}
      </form>
    </Card>
  );
}

function ProjectSettingsForm({ projects }: { projects: ProjectRow[] }) {
  const [pending, start] = useTransition();
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [columns, setColumns] = useState('["backlog","todo","in_progress","review","done"]');

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!projectId) return;
        let parsed: unknown;
        try {
          parsed = JSON.parse(columns);
        } catch {
          return;
        }
        start(() =>
          savePluginProjectSettingsAction("board", projectId, { columns: parsed }),
        );
      }}
    >
      <div>
        <label className="mb-1 block text-xs font-medium text-muted" htmlFor="project-select">Projeto</label>
        <select
          id="project-select"
          className="h-9 w-full rounded-lg border border-border bg-surface2 px-3 text-sm"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.key} — {p.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted" htmlFor="board-columns">
          Colunas Kanban (plugin board)
        </label>
        <textarea
          id="board-columns"
          className="min-h-20 w-full rounded-lg border border-border bg-surface2 px-3 py-2 font-mono text-xs"
          value={columns}
          onChange={(e) => setColumns(e.target.value)}
        />
      </div>
      <Button type="submit" size="sm" disabled={pending || !projectId}>Salvar override do projeto</Button>
    </form>
  );
}

function SettingsFieldInput({
  field,
  value,
  onChange,
}: {
  field: SettingsField;
  value: unknown;
  onChange: (val: unknown) => void;
}) {
  const id = `field-${field.key}`;

  if (field.type === "boolean") {
    return (
      <label className="flex items-center gap-2 text-sm" htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
        />
        {field.label}
      </label>
    );
  }

  if (field.type === "select") {
    return (
      <div>
        <label className="mb-1 block text-xs font-medium text-muted" htmlFor={id}>{field.label}</label>
        <select
          id={id}
          className="h-9 w-full rounded-lg border border-border bg-surface2 px-3 text-sm"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        >
          {field.options?.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
    );
  }

  if (field.type === "secret") {
    return (
      <div>
        <label className="mb-1 block text-xs font-medium text-muted" htmlFor={id}>{field.label}</label>
        <input
          id={id}
          type="password"
          className="h-9 w-full rounded-lg border border-border bg-surface2 px-3 text-sm"
          placeholder={value === "__MASKED__" ? "••••••••  (deixe vazio para manter)" : "Informe a chave"}
          value={value === "__MASKED__" ? "" : String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="off"
        />
        {field.description && <p className="mt-1 text-xs text-muted">{field.description}</p>}
      </div>
    );
  }

  if (field.type === "json") {
    return (
      <div>
        <label className="mb-1 block text-xs font-medium text-muted" htmlFor={id}>{field.label}</label>
        <textarea
          id={id}
          className="min-h-24 w-full rounded-lg border border-border bg-surface2 px-3 py-2 font-mono text-xs"
          value={typeof value === "string" ? value : JSON.stringify(value ?? field.defaultValue ?? null, null, 2)}
          onChange={(e) => {
            try {
              onChange(JSON.parse(e.target.value));
            } catch {
              onChange(e.target.value);
            }
          }}
        />
        {field.description && <p className="mt-1 text-xs text-muted">{field.description}</p>}
      </div>
    );
  }

  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted" htmlFor={id}>{field.label}</label>
      <input
        id={id}
        type={field.type === "number" ? "number" : "text"}
        className="h-9 w-full rounded-lg border border-border bg-surface2 px-3 text-sm"
        value={String(value ?? "")}
        onChange={(e) => onChange(field.type === "number" ? Number(e.target.value) : e.target.value)}
      />
      {field.description && <p className="mt-1 text-xs text-muted">{field.description}</p>}
    </div>
  );
}
