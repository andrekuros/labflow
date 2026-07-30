"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { createProject } from "@/plugins/projects/actions";
import { serializePaperMeta, EMPTY_PAPER_META, type PaperStatus } from "@/lib/projects/paper-meta";

export async function createPaperProject(input: {
  key: string;
  name: string;
  description?: string;
  color?: string;
  status?: PaperStatus;
  features?: Partial<import("@/lib/projects/features").ProjectFeatures>;
}) {
  const session = await getSession();
  if (!session) return { error: "Nao autenticado" };

  const project = await createProject({
    key: input.key,
    name: input.name,
    description: input.description,
    color: input.color ?? "#0ea5e9",
    kind: "paper",
    features: input.features,
  });

  await prisma.project.update({
    where: { id: project.id },
    data: {
      paperJson: serializePaperMeta({
        ...EMPTY_PAPER_META,
        abstract: input.description ?? "",
        status: input.status ?? "idea",
        objective: input.description ?? "",
      }),
    },
  });

  await prisma.milestone.createMany({
    data: [
      { projectId: project.id, name: "Rascunho interno", kind: "milestone", status: "upcoming" },
      { projectId: project.id, name: "Submissao", kind: "release", status: "upcoming" },
      { projectId: project.id, name: "Publicacao", kind: "release", status: "upcoming" },
    ],
  });

  revalidatePath("/papers");
  revalidatePath("/projects");
  return { id: project.id };
}
