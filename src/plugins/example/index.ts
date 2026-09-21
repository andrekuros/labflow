import "server-only";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac";
import { viewableProjectIds } from "@/lib/projects";
import type { PluginManifest } from "@/plugins/types";

/**
 * Example first-party plugin demonstrating the extension points:
 *  - aiTools: a read tool and a "propose" tool that drafts work for review
 *  - subscriptions: reacts to domain events
 *
 * The `ui` slot contribution is intentionally NOT registered. Its reference
 * implementation still lives in `./widget.tsx`: it listed every registered AI
 * tool name, which is a developer diagnostic, not something a lab wants on its
 * dashboard. To demo the slot, add it back:
 *
 *   import { ExampleWidget } from "@/plugins/example/widget";
 *   ui: [{ slot: "dashboard.widgets", component: ExampleWidget as never }],
 */
export const examplePlugin: PluginManifest = {
  id: "labflow.example-task-assistant",
  name: "Assistente de Tarefas",
  version: "1.0.0",
  description: "Plugin de exemplo: ferramentas de IA (list_projects para leitura, propose_task para rascunho revisavel) e assinante de eventos.",
  aiTools: [
    {
      name: "list_projects",
      description:
        "Lista os projetos visiveis ao usuario, com id, chave e nome. Use antes de propor qualquer artefato, para descobrir o projectId correto.",
      parameters: {},
      kind: "read",
      run: async (_args, ctx) => {
        if (!ctx.user) return "Erro: usuario nao identificado.";
        const ids = await viewableProjectIds(ctx.user);
        if (ids.length === 0) return "O usuario nao participa de nenhum projeto visivel.";

        const projects = await prisma.project.findMany({
          where: { id: { in: ids } },
          select: { id: true, key: true, name: true, status: true },
          orderBy: { key: "asc" },
        });
        return projects.map((p) => `${p.key} — ${p.name} [${p.status}] (id: ${p.id})`).join("\n");
      },
    },
    {
      name: "propose_task",
      description:
        "Propoe uma tarefa em um projeto. NAO cria a tarefa: gera um rascunho que aparece no projeto para uma pessoa revisar e aceitar.",
      parameters: {
        projectId: { type: "string", description: "ID do projeto (use list_projects para descobrir)" },
        title: { type: "string", description: "Titulo da tarefa" },
        description: { type: "string", description: "Descricao ou contexto da tarefa" },
        priority: { type: "string", description: "low | medium | high" },
      },
      required: ["projectId", "title"],
      kind: "propose",
      run: async (args, ctx) => {
        const projectId = String(args.projectId ?? "").trim();
        const title = String(args.title ?? "").trim();
        if (!projectId || !title) return "Erro: informe projectId e title.";
        if (!ctx.user) return "Erro: usuario nao identificado.";

        // Same permission as creating the task by hand: a draft the user could
        // never accept is worse than no draft at all.
        if (!(await hasPermission(ctx.user, "task:create", projectId))) {
          return "Sem permissao para propor tarefas neste projeto.";
        }

        const project = await prisma.project.findUnique({ where: { id: projectId }, select: { key: true } });
        if (!project) return "Projeto nao encontrado.";

        const priority = ["low", "medium", "high"].includes(String(args.priority))
          ? String(args.priority)
          : "medium";

        const draft = await prisma.aiDraft.create({
          data: {
            projectId,
            artifactType: "task",
            title,
            payload: JSON.stringify({
              title,
              description: String(args.description ?? ""),
              priority,
              status: "backlog",
            }),
            source: "ai",
            createdBy: ctx.user.id,
          },
        });

        return `Rascunho de tarefa criado em ${project.key}: "${title}". Ele esta pendente de revisao na aba de rascunhos do projeto (id do rascunho: ${draft.id}). Nenhuma tarefa foi criada ainda.`;
      },
    },
  ],
  subscriptions: [
    {
      event: "task.created",
      handler: (e) => {
        console.log(`[plugin:example] tarefa criada no projeto ${e.projectId}`);
      },
    },
  ],
};
