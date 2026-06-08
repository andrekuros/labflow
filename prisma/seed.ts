import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { localEmbed, chunkText } from "../src/lib/ai/embeddings";

const prisma = new PrismaClient();

async function embedArticle(sourceType: string, sourceId: string, projectId: string | null, text: string) {
  for (const chunk of chunkText(text)) {
    await prisma.embedding.create({
      data: {
        sourceType,
        sourceId,
        projectId,
        chunk,
        vector: JSON.stringify(localEmbed(chunk)),
      },
    });
  }
}

async function main() {
  console.log("Seeding LabFlow...");

  // Clean (dev convenience)
  await prisma.embedding.deleteMany();
  await prisma.post.deleteMany();
  await prisma.thread.deleteMany();
  await prisma.channel.deleteMany();
  await prisma.knowledgeArticle.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.milestone.deleteMany();
  await prisma.requirement.deleteMany();
  await prisma.deliverable.deleteMany();
  await prisma.task.deleteMany();
  await prisma.label.deleteMany();
  await prisma.sprint.deleteMany();
  await prisma.workPackage.deleteMany();
  await prisma.projectMembership.deleteMany();
  await prisma.project.deleteMany();
  await prisma.agentRun.deleteMany();
  await prisma.agentConfig.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.user.deleteMany();

  const pw = (p: string) => bcrypt.hashSync(p, 10);

  const ana = await prisma.user.create({
    data: { email: "admin@lab.edu", name: "Ana Admin", role: "admin", title: "Coordenadora", passwordHash: pw("admin123"), avatarColor: "#6366f1" },
  });
  const carlos = await prisma.user.create({
    data: { email: "carlos@lab.edu", name: "Carlos Pereira", role: "researcher", title: "Orientador / PI", passwordHash: pw("lab12345"), avatarColor: "#0ea5e9" },
  });
  const bruna = await prisma.user.create({
    data: { email: "bruna@lab.edu", name: "Bruna Lima", role: "phd", title: "Doutoranda", passwordHash: pw("lab12345"), avatarColor: "#ec4899" },
  });
  const diego = await prisma.user.create({
    data: { email: "diego@lab.edu", name: "Diego Souza", role: "msc", title: "Mestrando", passwordHash: pw("lab12345"), avatarColor: "#f59e0b" },
  });
  const elena = await prisma.user.create({
    data: { email: "elena@lab.edu", name: "Elena Rocha", role: "student", title: "IC", passwordHash: pw("lab12345"), avatarColor: "#10b981" },
  });

  const neuro = await prisma.project.create({
    data: {
      key: "NEURO",
      name: "Interfaces Neurais Adaptativas",
      description: "Pesquisa em BCIs adaptativas para reabilitacao motora.",
      color: "#8b5cf6",
      memberships: {
        create: [
          { userId: carlos.id, role: "lead" },
          { userId: bruna.id, role: "contributor" },
          { userId: elena.id, role: "contributor" },
          { userId: ana.id, role: "viewer" },
        ],
      },
    },
  });

  const robo = await prisma.project.create({
    data: {
      key: "ROBO",
      name: "Robotica Colaborativa",
      description: "Cobots para manipulacao assistida em ambientes nao estruturados.",
      color: "#0ea5e9",
      memberships: {
        create: [
          { userId: carlos.id, role: "lead" },
          { userId: diego.id, role: "contributor" },
        ],
      },
    },
  });

  // Labels
  const lblExp = await prisma.label.create({ data: { projectId: neuro.id, name: "Experimento", color: "#ef4444" } });
  const lblData = await prisma.label.create({ data: { projectId: neuro.id, name: "Analise de Dados", color: "#3b82f6" } });
  const lblWrite = await prisma.label.create({ data: { projectId: neuro.id, name: "Escrita", color: "#22c55e" } });
  await prisma.label.create({ data: { projectId: robo.id, name: "Hardware", color: "#f97316" } });
  await prisma.label.create({ data: { projectId: robo.id, name: "Controle", color: "#a855f7" } });

  // Work breakdown structure (systems engineering)
  const wbsAcq = await prisma.workPackage.create({
    data: { projectId: neuro.id, code: "1", name: "Aquisicao de Sinais", status: "in_progress", order: 0 },
  });
  const wbsProc = await prisma.workPackage.create({
    data: { projectId: neuro.id, code: "2", name: "Processamento e Decodificacao", status: "in_progress", order: 1 },
  });
  await prisma.workPackage.create({
    data: { projectId: neuro.id, parentId: wbsProc.id, code: "2.1", name: "Pipeline de filtragem", status: "done", order: 0 },
  });
  const wbsModel = await prisma.workPackage.create({
    data: { projectId: neuro.id, parentId: wbsProc.id, code: "2.2", name: "Modelo adaptativo", status: "in_progress", order: 1 },
  });

  // Sprints
  const sprint1 = await prisma.sprint.create({
    data: { projectId: neuro.id, name: "Sprint 1 - Coleta piloto", goal: "Validar protocolo de coleta", status: "completed",
      startDate: new Date(Date.now() - 28 * 86400000), endDate: new Date(Date.now() - 14 * 86400000) },
  });
  const sprint2 = await prisma.sprint.create({
    data: { projectId: neuro.id, name: "Sprint 2 - Decodificador", goal: "Primeira versao do decodificador adaptativo", status: "active",
      startDate: new Date(Date.now() - 7 * 86400000), endDate: new Date(Date.now() + 7 * 86400000) },
  });

  // Tasks
  await prisma.task.create({
    data: { projectId: neuro.id, workPackageId: wbsAcq.id, sprintId: sprint1.id, title: "Definir protocolo de aquisicao EEG", status: "done", priority: "high", creatorId: carlos.id, assignees: { connect: [{ id: bruna.id }] }, labels: { connect: [{ id: lblExp.id }] }, dueDate: new Date(Date.now() - 16 * 86400000) },
  });
  await prisma.task.create({
    data: { projectId: neuro.id, workPackageId: wbsModel.id, sprintId: sprint2.id, title: "Implementar baseline CSP+LDA", status: "in_progress", priority: "high", creatorId: bruna.id, assignees: { connect: [{ id: bruna.id }, { id: elena.id }] }, labels: { connect: [{ id: lblData.id }] }, startDate: new Date(Date.now() - 3 * 86400000), dueDate: new Date(Date.now() + 4 * 86400000) },
  });
  await prisma.task.create({
    data: { projectId: neuro.id, workPackageId: wbsModel.id, sprintId: sprint2.id, title: "Estudo de adaptacao online (riemannian)", status: "todo", priority: "medium", creatorId: carlos.id, assignees: { connect: [{ id: bruna.id }] }, labels: { connect: [{ id: lblData.id }] }, dueDate: new Date(Date.now() + 9 * 86400000) },
  });
  await prisma.task.create({
    data: { projectId: neuro.id, sprintId: sprint2.id, title: "Revisar literatura de transfer learning em BCI", status: "review", priority: "medium", creatorId: carlos.id, assignees: { connect: [{ id: elena.id }] }, labels: { connect: [{ id: lblWrite.id }] } },
  });
  await prisma.task.create({
    data: { projectId: neuro.id, title: "Preparar dataset publico (open data)", status: "backlog", priority: "low", creatorId: bruna.id, assignees: { connect: [{ id: elena.id }] }, labels: { connect: [{ id: lblData.id }] } },
  });
  await prisma.task.create({
    data: { projectId: robo.id, title: "Calibrar braco UR5", status: "in_progress", priority: "high", creatorId: diego.id, assignees: { connect: [{ id: diego.id }] } },
  });

  // Deliverables + requirements (traceability)
  const reqMain = await prisma.requirement.create({
    data: { projectId: neuro.id, code: "REQ-001", title: "Decodificador adaptativo com acuracia > 80%", kind: "functional", priority: "high", status: "approved" },
  });
  const reqLat = await prisma.requirement.create({
    data: { projectId: neuro.id, code: "REQ-002", title: "Latencia de decodificacao < 200ms", kind: "nonfunctional", priority: "medium", status: "proposed" },
  });

  const delPaper = await prisma.deliverable.create({
    data: { projectId: neuro.id, workPackageId: wbsModel.id, name: "Artigo - decodificador adaptativo", acceptance: "Submissao aceita em conferencia A1/A2.", status: "in_progress", dueDate: new Date(Date.now() + 45 * 86400000), requirements: { connect: [{ id: reqMain.id }] } },
  });
  await prisma.deliverable.create({
    data: { projectId: neuro.id, workPackageId: wbsProc.id, name: "Software de pipeline reproducivel", acceptance: "Repositorio com testes e documentacao.", status: "pending", dueDate: new Date(Date.now() + 30 * 86400000), requirements: { connect: [{ id: reqMain.id }, { id: reqLat.id }] } },
  });

  // link requirement -> activity
  await prisma.requirement.update({ where: { id: reqMain.id }, data: { activities: { connect: [{ id: wbsModel.id }] } } });

  // Milestones / roadmap
  await prisma.milestone.create({ data: { projectId: neuro.id, name: "Qualificacao de doutorado (Bruna)", kind: "milestone", date: new Date(Date.now() + 60 * 86400000), status: "upcoming" } });
  await prisma.milestone.create({ data: { projectId: neuro.id, name: "Verificacao do decodificador (V&V)", kind: "verification", date: new Date(Date.now() + 50 * 86400000), status: "upcoming" } });
  await prisma.milestone.create({ data: { projectId: neuro.id, name: "Coleta piloto concluida", kind: "milestone", date: new Date(Date.now() - 14 * 86400000), status: "reached" } });
  await prisma.milestone.create({ data: { projectId: robo.id, name: "Demo cobot v1", kind: "release", date: new Date(Date.now() + 80 * 86400000), status: "upcoming" } });

  // Forums
  const chGeneral = await prisma.channel.create({ data: { projectId: neuro.id, name: "geral", description: "Discussoes gerais do projeto NEURO" } });
  const thread = await prisma.thread.create({
    data: { channelId: chGeneral.id, authorId: bruna.id, title: "Qual metrica usar para comparar decodificadores?",
      posts: { create: [
        { authorId: bruna.id, content: "Estou em duvida entre acuracia balanceada e kappa de Cohen para o nosso setup multiclasse." },
        { authorId: carlos.id, content: "Para multiclasse desbalanceado prefiro kappa; reporte tambem a matriz de confusao por sessao." },
      ] } },
  });
  await embedArticle("post", thread.id, neuro.id, "metrica decodificadores acuracia balanceada kappa de cohen multiclasse matriz de confusao desbalanceado");
  await prisma.channel.create({ data: { projectId: robo.id, name: "geral", description: "Discussoes do projeto ROBO" } });

  // Knowledge base
  const art1 = await prisma.knowledgeArticle.create({
    data: { projectId: neuro.id, authorId: carlos.id, title: "Protocolo de aquisicao EEG do laboratorio", tags: "eeg,protocolo,coleta",
      content: "Montagem 32 canais, referencia em mastoide, impedancia abaixo de 10k ohms. Filtragem notch 60Hz. Janela de epoca de 2s com sobreposicao de 50%. Sessoes de calibracao com 40 trials por classe." },
  });
  await embedArticle("article", art1.id, neuro.id, art1.title + "\n" + "Montagem 32 canais, referencia em mastoide, impedancia abaixo de 10k ohms. Filtragem notch 60Hz. Janela de epoca de 2s com sobreposicao de 50%. Sessoes de calibracao com 40 trials por classe.");

  const art2 = await prisma.knowledgeArticle.create({
    data: { projectId: neuro.id, authorId: bruna.id, title: "Decisao: usar geometria Riemanniana", tags: "decodificador,riemann,decisao",
      content: "Decidimos adotar classificadores na variedade de matrizes de covariancia (MDM/tangent space) por robustez a ruido e bom desempenho com poucos dados. Baseline CSP+LDA fica como comparacao." },
  });
  await embedArticle("article", art2.id, neuro.id, art2.title + "\n" + "Decidimos adotar classificadores na variedade de matrizes de covariancia (MDM/tangent space) por robustez a ruido e bom desempenho com poucos dados. Baseline CSP+LDA fica como comparacao.");

  // AI agents
  await prisma.agentConfig.create({
    data: { key: "knowledge_qa", name: "Assistente de Conhecimento", description: "Responde perguntas usando o conhecimento acumulado (RAG).",
      instructions: "Voce e um assistente do laboratorio. Responda em portugues, de forma objetiva, sempre baseando-se no contexto fornecido. Cite a fonte quando possivel." },
  });
  await prisma.agentConfig.create({
    data: { key: "task_helper", name: "Organizador de Tarefas", description: "Sugere e estrutura tarefas a partir de descricoes.",
      instructions: "Ajude a quebrar objetivos de pesquisa em tarefas acionaveis e entregaveis, considerando conceitos de engenharia de sistemas (requisitos, WBS, V&V)." },
  });

  console.log("Seed completo. Login: admin@lab.edu / admin123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
