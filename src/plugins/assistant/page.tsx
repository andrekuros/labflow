import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { aiEnabled } from "@/lib/ai/provider";
import { PageHeader } from "@/components/ui";
import { AssistantChat } from "@/components/assistant/assistant-chat";

export default async function AssistantPage() {
  await requireUser();
  const [agents, llmOn] = await Promise.all([
    prisma.agentConfig.findMany({ where: { enabled: true }, orderBy: { createdAt: "asc" } }),
    aiEnabled(),
  ]);

  return (
    <div>
      <PageHeader
        title="Assistente de IA"
        description="Agentes que respondem com base no conhecimento acumulado (RAG) e podem usar ferramentas de plugins."
      />
      <AssistantChat
        aiEnabled={llmOn}
        agents={agents.map((a) => ({ key: a.key, name: a.name, description: a.description }))}
      />
    </div>
  );
}
