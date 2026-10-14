import type { PluginManifest } from "@/plugins/types";
import { prisma } from "@/lib/db";
import { buildSessionUser } from "@/lib/auth";
import type { SessionUser } from "@/lib/auth";
import type { AiToolContext } from "@/plugins/types";

/** Resolve the calling user, so every tool authorizes itself. */
async function resolveUser(ctx: AiToolContext): Promise<SessionUser | null> {
  if (ctx.user) return ctx.user;
  if (!ctx.userId) return null;
  const row = await prisma.user.findUnique({ where: { id: ctx.userId } });
  return row ? buildSessionUser(row) : null;
}

export const repositoryManifest: PluginManifest = {
  id: "repository",
  name: "Repositorio",
  version: "1.0.0",
  description:
    "Repositorio institucional de documentos (estilo DSpace/Invenio): colecoes, metadados bibliograficos, " +
    "upload de arquivos, handles citaveis, versoes, busca facetada e perguntas por IA sobre o acervo.",
  icon: "Library",
  nav: { label: "Repositorio", href: "/repository", icon: "Library", order: 72, group: "Conhecimento" },
  apiPrefix: "/api/v1/repository",
  aiTools: [
    {
      name: "search_repository",
      description:
        "Busca depositos no repositorio institucional (artigos, teses, datasets, relatorios, protocolos) " +
        "por assunto, autor, ano ou conteudo do arquivo. Use para localizar documentos citaveis.",
      parameters: {
        query: { type: "string", description: "Pergunta ou termos de busca" },
        limit: { type: "number", description: "Maximo de resultados (padrao 8)" },
      },
      required: ["query"],
      kind: "read",
      run: async (args, ctx) => {
        const query = String(args.query ?? "").trim();
        if (!query) return "Erro: informe query.";
        const user = await resolveUser(ctx);
        if (!user) return "Erro: usuario nao autenticado.";

        const limit = Math.min(20, Math.max(1, Number(args.limit) || 8));
        const { searchRepositoryDocs } = await import("@/lib/ai/agent");
        const sources = await searchRepositoryDocs(query, user, { limit });
        if (sources.length === 0) return "Nenhum deposito relevante no repositorio.";
        return sources
          .map(
            (s, i) =>
              `${i + 1}. ${s.title}${s.path ? ` [${s.path}]` : ""} — ${s.href ?? `/repository/${s.id}`} (score ${s.score.toFixed(2)})`,
          )
          .join("\n");
      },
    },
    {
      name: "ask_repository",
      description:
        "Responde uma pergunta usando o conteudo dos documentos depositados no repositorio, com citacoes. " +
        "Use quando a pergunta e sobre o que os documentos dizem, nao apenas quais existem.",
      parameters: {
        question: { type: "string", description: "Pergunta em linguagem natural" },
      },
      required: ["question"],
      kind: "read",
      run: async (args, ctx) => {
        const question = String(args.question ?? "").trim();
        if (!question) return "Erro: informe question.";
        const user = await resolveUser(ctx);
        if (!user) return "Erro: usuario nao autenticado.";

        const { askRepository } = await import("@/lib/ai/agent");
        const answer = await askRepository(question, { user });
        const refs = answer.sources
          .map((s, i) => `[${i + 1}] ${s.title}${s.path ? ` (${s.path})` : ""} — ${s.href ?? ""}`)
          .join("\n");
        return refs ? `${answer.answer}\n\nFontes:\n${refs}` : answer.answer;
      },
    },
  ],
  settingsSchema: [
    {
      key: "handlePrefix",
      label: "Prefixo dos handles",
      type: "text",
      defaultValue: "labflow",
      description: "Identificador citavel: <prefixo>/<ano>/<sequencial>. Ex: labflow/2026/000042.",
    },
    {
      key: "maxFileMb",
      label: "Tamanho maximo por arquivo (MB)",
      type: "number",
      defaultValue: 64,
    },
    {
      key: "defaultVisibility",
      label: "Visibilidade padrao de novos depositos",
      type: "select",
      options: [
        { value: "members", label: "Membros do laboratorio" },
        { value: "public", label: "Qualquer usuario autenticado" },
        { value: "admin", label: "Somente administradores" },
      ],
      defaultValue: "members",
    },
    {
      key: "requireReview",
      label: "Exigir revisao antes de publicar",
      type: "boolean",
      defaultValue: true,
      description:
        "Com revisao, quem deposita envia para analise e somente quem tem repository:manage publica.",
    },
    {
      key: "askAiEnabled",
      label: "Permitir perguntas por IA sobre o acervo",
      type: "boolean",
      defaultValue: true,
    },
  ],
  defaultSettings: {
    handlePrefix: "labflow",
    maxFileMb: 64,
    defaultVisibility: "members",
    requireReview: true,
    askAiEnabled: true,
  },
};
