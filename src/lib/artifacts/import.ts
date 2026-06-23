import "server-only";
import type { ArtifactsBundle } from "@/lib/artifacts/schema";
import { ARTIFACTS_FORMAT_VERSION } from "@/lib/artifacts/schema";
import { createDraftsFromBundle } from "@/lib/artifacts/accept-draft";

export function parseArtifactsJson(raw: string): ArtifactsBundle {
  const bundle = JSON.parse(raw) as ArtifactsBundle;
  if (!bundle.version) throw new Error("JSON sem campo version");
  if (bundle.version !== ARTIFACTS_FORMAT_VERSION) {
    throw new Error(`Versao ${bundle.version} nao suportada (esperado ${ARTIFACTS_FORMAT_VERSION})`);
  }
  return bundle;
}

export async function importArtifactsAsDrafts(
  projectId: string,
  raw: string,
  createdBy?: string,
): Promise<number> {
  const bundle = parseArtifactsJson(raw);
  return createDraftsFromBundle(projectId, bundle, "import", createdBy);
}
