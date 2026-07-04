import "server-only";
import { prisma } from "@/lib/db";
import { emit } from "@/lib/events";
import type { PluginManifest } from "@/plugins/types";
import { ExampleWidget } from "@/plugins/example/widget";

/**
 * Example first-party plugin demonstrating every extension point:
 *  - aiTools: a tool agents can call to create tasks (RBAC enforced)
 *  - ui: a dashboard widget
 *  - subscriptions: reacts to domain events
 */
export const examplePlugin: PluginManifest = {
  id: "labflow.example-task-assistant",
  name: "Assistente de Tarefas",
  version: "1.0.0",
  description: "Plugin de exemplo: ferramenta de IA para criar tarefas, widget no dashboard e assinante de eventos.",
  aiTools: [
    {
      name: "create_task",
      description: "Cria uma tarefa em um projeto. Use quando o usuario pedir para registrar/abrir uma tarefa.",
      parameters: {
        projectId: { type: "string", description: "ID do projeto" },
        title: { type: "string", description: "Titulo da tarefa" },
      },
      run: async (args, ctx) => {
        const projectId = String(args.projectId ?? "");
        const title = String(args.title ?? "");
        if (!projectId || !title) return "Erro: informe projectId e title.";
        if (!ctx.userId) return "Erro: usuario nao identificado.";

        const user = await prisma.user.findUnique({ where: { id: ctx.userId } });
        const membership = await prisma.projectMembership.findUnique({
          where: { userId_projectId: { userId: ctx.userId, projectId } },
        });
        const allowed = user?.role === "admin" || membership?.role === "lead" || membership?.role === "contributor";
        if (!allowed) return "Sem permissao para criar tarefas neste projeto.";

        const task = await prisma.task.create({
          data: { projectId, title, creatorId: ctx.userId, status: "backlog" },
        });
        await emit({ type: "task.created", actorId: ctx.userId, projectId, targetId: task.id, payload: { id: task.id, title } });
        return `Tarefa criada com sucesso: "${title}".`;
      },
    },
  ],
  ui: [{ slot: "dashboard.widgets", component: ExampleWidget as never }],
  subscriptions: [
    {
      event: "task.created",
      handler: (e) => {
        console.log(`[plugin:example] tarefa criada no projeto ${e.projectId}`);
      },
    },
  ],
};
