import type { ArtifactsBundle, ArtifactType } from "@/lib/artifacts/schema";
import { artifactKey } from "@/lib/artifacts/existing-summary";

const SECTIONS: { type: ArtifactType; field: keyof ArtifactsBundle }[] = [
  { type: "requirement", field: "requirements" },
  { type: "task", field: "tasks" },
  { type: "deliverable", field: "deliverables" },
  { type: "work_package", field: "workPackages" },
  { type: "milestone", field: "milestones" },
  { type: "system_element", field: "systemElements" },
  { type: "verification_case", field: "verificationCases" },
];

export function filterNewArtifacts(
  bundle: ArtifactsBundle,
  existingKeys: Set<string>,
  types: ArtifactType[],
): { bundle: ArtifactsBundle; skipped: number } {
  let skipped = 0;
  const out: ArtifactsBundle = {
    version: bundle.version,
    exportedAt: bundle.exportedAt ?? new Date().toISOString(),
  };

  for (const { type, field } of SECTIONS) {
    if (!types.includes(type)) continue;
    const items = bundle[field] as Record<string, unknown>[] | undefined;
    if (!items?.length) continue;
    const kept: Record<string, unknown>[] = [];
    for (const item of items) {
      const key = artifactKey(type, item);
      if (existingKeys.has(key)) {
        skipped += 1;
        continue;
      }
      kept.push(item);
      existingKeys.add(key);
    }
    if (kept.length) (out as Record<string, unknown>)[field] = kept;
  }

  return { bundle: out, skipped };
}
