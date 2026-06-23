export const REQ_LEVEL: Record<string, string> = {
  stakeholder: "Necessidade do stakeholder",
  system: "Requisito de sistema",
  subsystem: "Requisito de subsistema",
  component: "Requisito de componente",
  derived: "Derivado",
};

export const SE_GATES: Record<string, { label: string; color: string }> = {
  SRR: { label: "SRR — Revisao de requisitos", color: "#6366f1" },
  PDR: { label: "PDR — Revisao preliminar de design", color: "#3b82f6" },
  CDR: { label: "CDR — Revisao critica de design", color: "#8b5cf6" },
  TRR: { label: "TRR — Revisao de testes", color: "#f59e0b" },
  FRR: { label: "FRR — Revisao de voo/entrega", color: "#22c55e" },
};

export const SYS_KIND: Record<string, string> = {
  system: "Sistema",
  subsystem: "Subsistema",
  component: "Componente",
  external: "Externo",
};

export const IFACE_KIND: Record<string, string> = {
  mechanical: "Mecanica",
  electrical: "Eletrica",
  data: "Dados",
  thermal: "Termica",
  software: "Software",
};

export const VV_METHOD: Record<string, string> = {
  test: "Teste",
  analysis: "Analise",
  inspection: "Inspecao",
  demonstration: "Demonstracao",
  simulation: "Simulacao",
};

export const VV_STATUS: Record<string, { label: string; color: string }> = {
  planned: { label: "Planejado", color: "#64748b" },
  in_progress: { label: "Em execucao", color: "#3b82f6" },
  passed: { label: "Aprovado", color: "#22c55e" },
  failed: { label: "Reprovado", color: "#ef4444" },
  waived: { label: "Dispensado", color: "#a855f7" },
};
