import type { PluginManifest } from "@/plugins/types";

/** Legacy routes redirect to /thesis — kept registered without nav. */
export const academicManifest: PluginManifest = {
  id: "academic",
  name: "Acompanhamento academico",
  version: "1.0.0",
  description: "Metodologia cientifica, disciplinas e pendencias de mestrado/doutorado.",
  icon: "GraduationCap",
  apiPrefix: "/api/v1/academic",
};
