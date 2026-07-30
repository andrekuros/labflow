export const ACCOUNT_STATUSES = ["active", "pending", "rejected"] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const ACCOUNT_STATUS_LABELS: Record<AccountStatus, string> = {
  active: "Ativo",
  pending: "Aguardando aprovacao",
  rejected: "Rejeitado",
};
