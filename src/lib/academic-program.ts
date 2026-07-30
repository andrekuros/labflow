import "server-only";

import { prisma } from "@/lib/db";
import {
  type AcademicProgram,
  resolveAcademicProgram,
} from "@/lib/academic-program-meta";

export {
  ACADEMIC_PROGRAMS,
  ACADEMIC_PROGRAM_LABELS,
  ACADEMIC_PROGRAM_TYPE_LABELS,
  ACADEMIC_PROFILE_KEYS,
  type AcademicProgram,
  isAcademicProgram,
  resolveAcademicProgram,
  applyProgramToProfiles,
  academicProgramTypeLabel,
} from "@/lib/academic-program-meta";

/** Sincroniza AcademicProfile.program com os perfis do usuário. */
export async function syncAcademicProfileProgram(userId: string, profiles: string[]) {
  const program = resolveAcademicProgram(profiles);
  return prisma.academicProfile.upsert({
    where: { userId },
    create: { userId, program },
    update: { program },
  });
}
