/** Metadados de programa acadêmico — compartilhado entre client e server. */

import { normalizeProfiles } from "@/lib/profile-meta";

export const ACADEMIC_PROGRAMS = ["msc", "phd", "postdoc", "professor", "student"] as const;
export type AcademicProgram = (typeof ACADEMIC_PROGRAMS)[number];

/** Perfis de sistema que mapeiam 1:1 para um programa acadêmico. */
export const ACADEMIC_PROFILE_KEYS = ["phd", "postdoc", "msc", "student", "professor"] as const;

export const ACADEMIC_PROGRAM_LABELS: Record<AcademicProgram, string> = {
  msc: "Mestrando",
  phd: "Doutorando",
  postdoc: "Pos-doutorando",
  professor: "Professor",
  student: "Aluno",
};

/** Rótulos do tipo de programa (formulário / badges). */
export const ACADEMIC_PROGRAM_TYPE_LABELS: Record<AcademicProgram, string> = {
  msc: "Mestrado",
  phd: "Doutorado",
  postdoc: "Pos-doutorado",
  professor: "Professor",
  student: "Aluno / IC",
};

const PROGRAM_PRIORITY: AcademicProgram[] = ["phd", "postdoc", "msc", "student", "professor"];
const ACADEMIC_PROFILE_SET = new Set<string>(ACADEMIC_PROFILE_KEYS);

export function isAcademicProgram(value: string): value is AcademicProgram {
  return (ACADEMIC_PROGRAMS as readonly string[]).includes(value);
}

/** Deriva o programa acadêmico a partir dos perfis do usuário (fonte canônica). */
export function resolveAcademicProgram(profiles: string[]): AcademicProgram {
  const set = new Set(normalizeProfiles(profiles));
  for (const program of PROGRAM_PRIORITY) {
    if (set.has(program)) return program;
  }
  return "msc";
}

/** Substitui perfis acadêmicos mantendo papéis de sistema (admin, researcher, etc.). */
export function applyProgramToProfiles(current: string[], program: AcademicProgram): string[] {
  const kept = normalizeProfiles(current).filter((p) => !ACADEMIC_PROFILE_SET.has(p));
  return normalizeProfiles([...kept, program]);
}

export function academicProgramTypeLabel(program: string): string {
  return isAcademicProgram(program) ? ACADEMIC_PROGRAM_TYPE_LABELS[program] : program;
}
