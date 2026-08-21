import type { PluginManifest } from "@/plugins/types";
import { prisma } from "@/lib/db";
import { buildSessionUser } from "@/lib/auth";

export const knowledgeManifest: PluginManifest = {
  id: "knowledge",
  name: "Conhecimento",
  version: "1.2.0",
  description: "Biblioteca do vault Nextcloud (wiki, PDF, DOCX, Excel, PowerPoint) com busca semantica, vinculos LabFlow e RAG.",
  icon: "BookOpen",
  nav: { label: "Biblioteca", href: "/knowledge", icon: "BookOpen", order: 70, group: "Conhecimento" },
  apiPrefix: "/api/v1/knowledge",
  aiTools: [
    {
      name: "search_library",
      description:
        "Busca documentos da biblioteca (markdown, PDF, DOCX, Excel e PowerPoint do vault Nextcloud). Use para protocolos, papers e documentacao.",
      parameters: {
        query: { type: "string", description: "Pergunta ou termos de busca" },
      },
      run: async (args, ctx) => {
        const query = String(args.query ?? "").trim();
        if (!query) return "Erro: informe query.";
        let user = null;
        if (ctx.userId) {
          const row = await prisma.user.findUnique({ where: { id: ctx.userId } });
          if (row) user = await buildSessionUser(row);
        }
        const { searchLibrary } = await import("@/lib/ai/agent");
        const sources = await searchLibrary(query, user);
        if (sources.length === 0) return "Nenhum documento relevante na biblioteca.";
        return sources
          .map(
            (s, i) =>
              `${i + 1}. ${s.title}${s.path ? ` [${s.path}]` : ""} — ${s.href ?? `/knowledge/${s.id}`} (score ${s.score.toFixed(2)})`,
          )
          .join("\n");
      },
    },
  ],
  settingsSchema: [
    {
      key: "enableSemanticSearch",
      label: "Busca semantica habilitada",
      type: "boolean",
      defaultValue: true,
      description: "A qualidade depende de um modelo de embedding real (OpenAI). Ollama usa vetores locais hashed.",
    },
    {
      key: "autoIngest",
      label: "Indexar automaticamente no RAG",
      type: "boolean",
      defaultValue: true,
    },
    {
      key: "ragScanLimit",
      label: "Limite de embeddings na busca semantica",
      type: "number",
      defaultValue: 2000,
      description: "Quantidade maxima de chunks analisados por busca (padrao 2000).",
    },
    {
      key: "nextcloudEnabled",
      label: "Sincronizar com Nextcloud",
      type: "boolean",
      defaultValue: false,
    },
    {
      key: "nextcloudUrl",
      label: "URL do Nextcloud",
      type: "text",
      description: "Ex: https://cloud.conceptio.com.br",
      defaultValue: "",
    },
    {
      key: "nextcloudUsername",
      label: "Usuario Nextcloud",
      type: "text",
      defaultValue: "",
    },
    {
      key: "nextcloudAppPassword",
      label: "Senha de app",
      type: "secret",
      description: "Gere em Nextcloud > Configuracoes > Seguranca > Senhas de app",
    },
    {
      key: "nextcloudFolder",
      label: "Pasta do vault",
      type: "text",
      defaultValue: "LabFlow",
      description: "Pasta do usuario. Sync: .md, .txt, .pdf, .docx, .xlsx, .xls, .pptx, .ppt.",
    },
  ],
  defaultSettings: {
    enableSemanticSearch: true,
    autoIngest: true,
    ragScanLimit: 2000,
    nextcloudEnabled: false,
    nextcloudUrl: "",
    nextcloudUsername: "",
    nextcloudAppPassword: "",
    nextcloudFolder: "LabFlow",
    nextcloudAutoSyncEnabled: false,
    nextcloudAutoSyncIntervalMinutes: 60,
    nextcloudFolderProjectMap: {},
    nextcloudExcludeFolders: ["templates"],
    nextcloudAdminOnlyFolders: ["admin"],
    nextcloudLastSyncAt: null,
    nextcloudLastSyncStatus: null,
    nextcloudLastSyncMessage: null,
    nextcloudLastSyncCount: 0,
  },
};
