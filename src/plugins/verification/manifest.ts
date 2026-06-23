import type { PluginManifest } from "@/plugins/types";

export const verificationManifest: PluginManifest = {
  id: "verification",
  name: "Verificacao e validacao",
  version: "1.0.0",
  description: "Casos de V&V e matriz de verificacao de requisitos.",
  icon: "ShieldCheck",
  nav: { label: "V&V", href: "/verification", icon: "ShieldCheck", order: 55, group: "Planejamento" },
  requires: ["requirements"],
  apiPrefix: "/api/v1/verification",
  defaultSettings: {},
};
