import "server-only";
import { chat, type ChatMessage } from "@/lib/ai/provider";
import type { LabTeamCapabilityData, MemberCapabilityRow } from "@/lib/team/capabilities";

function memberSummary(m: MemberCapabilityRow): string {
  const lines = [
    `Nome: ${m.name}`,
    `Perfis: ${m.profilesLabel}`,
    `Projetos: ${m.projects.map((p) => `${p.key}(${p.role})`).join(", ") || "nenhum"}`,
    `Tarefas: ${m.taskStats.total} total, ${m.taskStats.done} concluidas, ${m.taskStats.open} abertas`,
    `Estimativa acumulada: ${m.taskStats.totalEstimateHours}h`,
    `Areas WBS: ${m.wbsAreas.join("; ") || "nenhuma"}`,
    `Categorias: ${m.labelNames.join(", ") || "nenhuma"}`,
    `Atividade 90d: ${m.activityCount90d} eventos`,
  ];
  if (m.academic?.objective) lines.push(`Objetivo academico: ${m.academic.objective.slice(0, 200)}`);
  if (m.recentTasks.length) {
    lines.push(
      `Tarefas recentes: ${m.recentTasks.map((t) => `${t.projectKey}:${t.title}[${t.status}]`).join("; ")}`,
    );
  }
  return lines.join("\n");
}

function buildPrompt(m: MemberCapabilityRow): string {
  return `Analise o perfil de capacidades deste integrante de laboratorio de pesquisa com base APENAS nos dados abaixo.

${memberSummary(m)}

Escreva em portugues, 3-5 frases objetivas cobrindo:
1. Competencias tecnicas e dominios inferidos das tarefas e WBS
2. Carga de trabalho atual (aberta vs concluida)
3. Em que tipos de tarefa ou projeto seria mais util
4. Recomendacao breve para alocacao em novos projetos

Nao invente historico, certificacoes ou habilidades sem evidencia nos dados.`;
}

export async function enrichMemberCapabilityWithAi(
  member: MemberCapabilityRow,
): Promise<string> {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: "Voce resume capacidades de pesquisadores com base em dados operacionais. Resposta em texto corrido, sem markdown.",
    },
    { role: "user", content: buildPrompt(member) },
  ];
  const raw = await chat(messages);
  return raw.trim();
}

export async function enrichLabCapabilitiesWithAi(
  data: LabTeamCapabilityData,
): Promise<{ userId: string; name: string; analysis: string }[]> {
  const results: { userId: string; name: string; analysis: string }[] = [];
  for (const m of data.members) {
    try {
      const analysis = await enrichMemberCapabilityWithAi(m);
      results.push({ userId: m.userId, name: m.name, analysis });
    } catch {
      results.push({
        userId: m.userId,
        name: m.name,
        analysis: "Analise automatica indisponivel — revise os dados estruturados acima.",
      });
    }
  }
  return results;
}
