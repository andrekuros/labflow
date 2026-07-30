import "server-only";
import { prisma } from "@/lib/db";
import { parseConops } from "@/lib/artifacts/schema";
import { parseChecklist } from "@/lib/task-checklist";

/** Compact project snapshot for AI prompts (tasks, WBS, requirements, etc.). */
export async function loadProjectContextForAi(projectId: string): Promise<string> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      memberships: { include: { user: { select: { name: true, role: true } } } },
      workPackages: { orderBy: [{ order: "asc" }], select: { code: true, name: true, status: true } },
      sprints: { orderBy: { createdAt: "desc" }, take: 8, select: { name: true, status: true, goal: true } },
    },
  });
  if (!project) return "";

  const [requirements, deliverables, tasks, articles] = await Promise.all([
    prisma.requirement.findMany({
      where: { projectId },
      take: 40,
      orderBy: { code: "asc" },
      select: { code: true, title: true, status: true, priority: true },
    }),
    prisma.deliverable.findMany({
      where: { projectId },
      take: 25,
      orderBy: { updatedAt: "desc" },
      select: { name: true, status: true, dueDate: true },
    }),
    prisma.task.findMany({
      where: { projectId },
      take: 50,
      orderBy: { updatedAt: "desc" },
      select: {
        title: true,
        status: true,
        priority: true,
        estimate: true,
        checklistJson: true,
        workPackage: { select: { code: true, name: true } },
      },
    }),
    prisma.knowledgeArticle.findMany({
      where: { projectId },
      take: 15,
      orderBy: { updatedAt: "desc" },
      select: { title: true },
    }),
  ]);

  const conops = parseConops(project.conops);
  const lines: string[] = [
    `Projeto: ${project.key} — ${project.name}`,
    project.description ? `Descricao: ${project.description}` : "",
    `Status: ${project.status}`,
    project.memberships.length
      ? `Equipe: ${project.memberships.map((m) => `${m.user.name} (${m.role})`).join(", ")}`
      : "",
  ];

  if (conops.mission) lines.push(`CONOPS missao: ${conops.mission}`);
  if (conops.scope) lines.push(`CONOPS escopo: ${conops.scope}`);
  if (conops.conceptOfOperations) lines.push(`CONOPS conceito: ${conops.conceptOfOperations.slice(0, 800)}`);
  if (conops.successCriteria) lines.push(`Criterios de sucesso: ${conops.successCriteria}`);

  if (project.workPackages.length) {
    lines.push("\nWBS:");
    project.workPackages.forEach((w) => {
      lines.push(`- ${w.code ?? "?"} ${w.name} (${w.status})`);
    });
  }

  if (requirements.length) {
    lines.push("\nRequisitos:");
    requirements.forEach((r) => {
      lines.push(`- ${r.code ?? "?"} ${r.title} [${r.status}]`);
    });
  }

  if (deliverables.length) {
    lines.push("\nEntregaveis:");
    deliverables.forEach((d) => {
      lines.push(`- ${d.name} [${d.status}]`);
    });
  }

  if (project.sprints.length) {
    lines.push("\nSprints:");
    project.sprints.forEach((s) => {
      lines.push(`- ${s.name} [${s.status}]${s.goal ? `: ${s.goal.slice(0, 80)}` : ""}`);
    });
  }

  if (tasks.length) {
    lines.push("\nOutras tarefas do projeto:");
    tasks.forEach((t) => {
      const wbs = t.workPackage ? ` WBS:${t.workPackage.code ?? t.workPackage.name}` : "";
      const steps = parseChecklist(t.checklistJson);
      const stepsNote = steps.length ? ` (${steps.filter((s) => s.done).length}/${steps.length} steps)` : "";
      lines.push(`- ${t.title} [${t.status}/${t.priority}]${wbs}${stepsNote}`);
    });
  }

  if (articles.length) {
    lines.push("\nArtigos de conhecimento:");
    articles.forEach((a) => lines.push(`- ${a.title}`));
  }

  return lines.filter(Boolean).join("\n");
}
