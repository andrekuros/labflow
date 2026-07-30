"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { createProject } from "@/plugins/projects/actions";
import { type ProjectKind } from "@/lib/projects/features";
import { serializeAcademicMeta, EMPTY_ACADEMIC_META } from "@/lib/projects/academic-meta";

export async function createThesisOrDissertation(input: {
  kind: "thesis" | "dissertation";
  key: string;
  name: string;
  description?: string;
  color?: string;
  features?: Partial<import("@/lib/projects/features").ProjectFeatures>;
}) {
  const session = await getSession();
  if (!session) return { error: "Nao autenticado" };

  const kind: ProjectKind = input.kind;
  const project = await createProject({
    key: input.key,
    name: input.name,
    description: input.description,
    color: input.color ?? (kind === "thesis" ? "#7c3aed" : "#2563eb"),
    kind,
    features: input.features,
  });

  await prisma.project.update({
    where: { id: project.id },
    data: {
      academicJson: serializeAcademicMeta({
        ...EMPTY_ACADEMIC_META,
        objective: input.description ?? "",
      }),
    },
  });

  await prisma.milestone.createMany({
    data: [
      { projectId: project.id, name: "Qualificacao", kind: "milestone", status: "upcoming" },
      { projectId: project.id, name: "Defesa", kind: "release", status: "upcoming" },
    ],
  });

  revalidatePath("/thesis");
  revalidatePath("/projects");
  return { id: project.id };
}
