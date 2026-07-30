import type { ConopsData, ArtifactType } from "@/lib/artifacts/schema";
import { prisma } from "@/lib/db";

export type ProjectTemplateKey = "blank" | "se" | "software" | "hardware" | "conops" | "admin";

export type ProjectTemplate = {
  key: ProjectTemplateKey;
  label: string;
  description: string;
  kind: "lab" | "admin";
  defaultArtifactTypes: ArtifactType[];
  conops: (name: string, description?: string) => ConopsData;
};

function conops(
  name: string,
  description: string | undefined,
  partial: Partial<ConopsData>,
): ConopsData {
  return {
    mission: partial.mission ?? "",
    scope: partial.scope ?? "",
    stakeholders: partial.stakeholders ?? "",
    operatingEnvironment: partial.operatingEnvironment ?? "",
    conceptOfOperations: partial.conceptOfOperations ?? "",
    constraints: partial.constraints ?? "",
    successCriteria: partial.successCriteria ?? "",
    assumptions: partial.assumptions ?? "",
  };
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    key: "blank",
    label: "Projeto em branco",
    description: "Sem estrutura inicial. Preencha o CONOPS manualmente.",
    kind: "lab",
    defaultArtifactTypes: ["requirement", "task", "deliverable"],
    conops: () => ({
      mission: "",
      scope: "",
      stakeholders: "",
      operatingEnvironment: "",
      conceptOfOperations: "",
      constraints: "",
      successCriteria: "",
      assumptions: "",
    }),
  },
  {
    key: "admin",
    label: "Administrativo",
    description: "Projeto interno do lab (board, knowledge, forum). Sem WBS/SE.",
    kind: "admin",
    defaultArtifactTypes: ["task"],
    conops: (name) =>
      conops(name, undefined, {
        mission: `Organizar atividades administrativas: ${name}.`,
        scope: "Tarefas internas, documentacao e comunicacao do laboratorio.",
      }),
  },
  {
    key: "conops",
    label: "CONOPS",
    description: "Foco em documentar o conceito de operacoes antes dos artefatos.",
    kind: "lab",
    defaultArtifactTypes: ["requirement", "deliverable", "milestone"],
    conops: (name, description) =>
      conops(name, description, {
        mission: `Definir e validar o conceito de operacoes do projeto ${name}.`,
        scope: description ?? `Documentar missao, usuarios, cenarios de uso e criterios de sucesso para ${name}.`,
        stakeholders: "Patrocinador, equipe tecnica, usuarios finais, revisores.",
        operatingEnvironment: "Descreva onde o sistema/produto sera usado, condicoes e interfaces externas.",
        conceptOfOperations: `1) Contexto e motivacao\n2) Usuarios e papéis\n3) Cenarios operacionais principais\n4) Fluxos de trabalho\n5) Modos de falha e contingencias`,
        constraints: "Prazo, orcamento, normas aplicaveis, dependencias externas.",
        successCriteria: "CONOPS revisado e aprovado; requisitos derivados rastreaveis ao CONOPS.",
        assumptions: "Stakeholders disponiveis para entrevistas; informacao suficiente para primeira versao.",
      }),
  },
  {
    key: "software",
    label: "Software",
    description: "Produto de software com requisitos, sprints e entregaveis tecnicos.",
    kind: "lab",
    defaultArtifactTypes: ["requirement", "task", "deliverable", "work_package", "verification_case"],
    conops: (name, description) =>
      conops(name, description, {
        mission: `Desenvolver e entregar o software ${name}.`,
        scope: description ?? "Requisitos, arquitetura, implementacao, testes, deploy e documentacao.",
        stakeholders: "Product owner, desenvolvedores, QA, usuarios finais, DevOps.",
        operatingEnvironment: "Ambientes dev/staging/producao; integracoes com APIs e servicos externos.",
        conceptOfOperations: `1) Usuario acessa o sistema\n2) Fluxos principais (CRUD, autenticacao, relatorios)\n3) Integracoes e jobs em background\n4) Monitoramento e suporte pos-deploy`,
        constraints: "Stack tecnologica, performance, seguranca (LGPD), cobertura de testes minima.",
        successCriteria: "MVP em producao; requisitos criticos verificados; documentacao de API e usuario.",
        assumptions: "Repositorio e CI/CD disponiveis; requisitos podem evoluir por sprint.",
      }),
  },
  {
    key: "hardware",
    label: "Hardware",
    description: "Engenharia de hardware com SoI, interfaces e gates de design.",
    kind: "lab",
    defaultArtifactTypes: ["requirement", "system_element", "deliverable", "milestone", "verification_case"],
    conops: (name, description) =>
      conops(name, description, {
        mission: `Projetar, fabricar e validar o hardware ${name}.`,
        scope: description ?? "Requisitos, arquitetura eletronica/mecanica, prototipagem, testes e integracao.",
        stakeholders: "Engenheiros eletrica/mecanica, fornecedores, montadores, usuarios finais.",
        operatingEnvironment: "Condicoes eletricas, termicas, vibracao, EMC; interfaces fisicas e protocolos.",
        conceptOfOperations: `1) Modos de operacao (ligado, standby, calibracao)\n2) Interfaces com usuario e outros sistemas\n3) Procedimentos de manutencao e diagnostico\n4) Cenarios de teste em bancada e campo`,
        constraints: "Custo BOM, certificacoes, tolerancias de fabricacao, prazo de prototipo.",
        successCriteria: "Protótipo atende requisitos; testes V&V aprovados; documentacao de fabricacao.",
        assumptions: "Componentes disponiveis no mercado; fornecedor de PCB definido.",
      }),
  },
  {
    key: "se",
    label: "Engenharia de Sistemas",
    description: "WBS classica, gates SRR–FRR, System of Interest e requisitos exemplo.",
    kind: "lab",
    defaultArtifactTypes: ["requirement", "work_package", "milestone", "system_element", "verification_case"],
    conops: (name, description) =>
      conops(name, description, {
        mission: `Entregar o sistema ${name} com abordagem de engenharia de sistemas.`,
        scope: description ?? "Requisitos, arquitetura, design, implementacao, integracao e V&V.",
        stakeholders: "Patrocinador, engenharia de sistemas, especialistas de dominio, V&V.",
        operatingEnvironment: "Contexto operacional do System of Interest e sistemas externos.",
        conceptOfOperations: `1) Missao do sistema\n2) Operadores e modos\n3) Cenarios e sequencias operacionais\n4) Interfaces externas\n5) Decomposicao em subsistemas`,
        constraints: "Gates de revisao (SRR, PDR, CDR, TRR, FRR); rastreabilidade requisito–design–teste.",
        successCriteria: "Requisitos aprovados nos gates; V&V demonstra conformidade.",
        assumptions: "Equipe multidisciplinar; baseline de requisitos controlada por versao.",
      }),
  },
];

export function getProjectTemplate(key: ProjectTemplateKey): ProjectTemplate {
  return PROJECT_TEMPLATES.find((t) => t.key === key) ?? PROJECT_TEMPLATES[0];
}

export async function applyProjectTemplate(
  projectId: string,
  templateKey: ProjectTemplateKey,
  input: { name: string; description?: string },
) {
  const tpl = getProjectTemplate(templateKey);
  if (templateKey === "blank") return;

  await prisma.project.update({
    where: { id: projectId },
    data: { conops: JSON.stringify(tpl.conops(input.name, input.description)) },
  });

  if (templateKey === "se") {
    await applySeTemplate(projectId, input.name);
    return;
  }

  if (templateKey === "admin") {
    return;
  }

  if (templateKey === "software") {
    const wbs = [
      { code: "1", name: "Descoberta e requisitos" },
      { code: "2", name: "Arquitetura e design" },
      { code: "3", name: "Implementacao" },
      { code: "4", name: "Testes e QA" },
      { code: "5", name: "Deploy e operacao" },
    ];
    for (const [i, w] of wbs.entries()) {
      await prisma.workPackage.create({ data: { projectId, code: w.code, name: w.name, order: i } });
    }
    await prisma.deliverable.createMany({
      data: [
        { projectId, name: "MVP", status: "pending" },
        { projectId, name: "Documentacao tecnica", status: "pending" },
      ],
    });
    return;
  }

  if (templateKey === "hardware") {
    await prisma.systemElement.create({
      data: { projectId, name: input.name, kind: "system", description: "System of Interest" },
    });
    const wbs = [
      { code: "1", name: "Requisitos e CONOPS" },
      { code: "2", name: "Design eletronico/mecanico" },
      { code: "3", name: "Prototipagem" },
      { code: "4", name: "Testes de bancada" },
      { code: "5", name: "Integracao e validacao" },
    ];
    for (const [i, w] of wbs.entries()) {
      await prisma.workPackage.create({ data: { projectId, code: w.code, name: w.name, order: i } });
    }
    await prisma.milestone.createMany({
      data: [
        { projectId, name: "PDR", gate: "PDR", kind: "verification", status: "upcoming" },
        { projectId, name: "CDR", gate: "CDR", kind: "verification", status: "upcoming" },
        { projectId, name: "TRR", gate: "TRR", kind: "verification", status: "upcoming" },
      ],
    });
    return;
  }

  if (templateKey === "conops") {
    await prisma.milestone.create({
      data: { projectId, name: "Revisao do CONOPS", kind: "verification", status: "upcoming" },
    });
    await prisma.deliverable.create({
      data: { projectId, name: "Documento CONOPS v1", status: "pending" },
    });
  }
}

async function applySeTemplate(projectId: string, name: string) {
  const wbs = [
    { code: "1", name: "Concepcao" },
    { code: "2", name: "Requisitos" },
    { code: "3", name: "Design" },
    { code: "4", name: "Implementacao" },
    { code: "5", name: "Integracao" },
    { code: "6", name: "Verificacao e validacao" },
  ];
  for (const [i, w] of wbs.entries()) {
    await prisma.workPackage.create({ data: { projectId, code: w.code, name: w.name, order: i } });
  }
  const gates = [
    { gate: "SRR", name: "System Requirements Review", kind: "verification" },
    { gate: "PDR", name: "Preliminary Design Review", kind: "verification" },
    { gate: "CDR", name: "Critical Design Review", kind: "verification" },
    { gate: "TRR", name: "Test Readiness Review", kind: "verification" },
    { gate: "FRR", name: "Flight/Field Readiness Review", kind: "release" },
  ];
  for (const g of gates) {
    await prisma.milestone.create({
      data: { projectId, name: g.name, gate: g.gate, kind: g.kind, status: "upcoming" },
    });
  }
  await prisma.systemElement.create({
    data: { projectId, name, kind: "system", description: "System of Interest" },
  });
  await prisma.requirement.createMany({
    data: [
      { projectId, code: "SN-001", title: "Necessidade do stakeholder (exemplo)", level: "stakeholder", kind: "goal", status: "proposed" },
      { projectId, code: "SYS-001", title: "Requisito de sistema (exemplo)", level: "system", kind: "functional", status: "proposed" },
    ],
  });
}
