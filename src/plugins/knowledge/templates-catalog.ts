export type TemplateKey = "protocolo" | "equipamento" | "nota-projeto" | "relatorio";

export const TEMPLATE_CATALOG: Record<TemplateKey, { label: string; filename: string }> = {
  protocolo: { label: "Protocolo experimental", filename: "novo-protocolo.md" },
  equipamento: { label: "Ficha de equipamento", filename: "novo-equipamento.md" },
  "nota-projeto": { label: "Nota de projeto", filename: "nova-nota.md" },
  relatorio: { label: "Relatorio", filename: "novo-relatorio.md" },
};
