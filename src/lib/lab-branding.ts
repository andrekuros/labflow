import "server-only";
import { prisma } from "@/lib/db";
import {
  DEFAULT_LAB_NAME,
  LAB_LOGO_URL_KEY,
  LAB_NAME_KEY,
  type LabBranding,
} from "@/lib/lab-branding-shared";

export type { LabBranding };
export { DEFAULT_LAB_NAME, LAB_LOGO_URL_KEY, LAB_NAME_KEY };

export async function getLabBranding(): Promise<LabBranding> {
  const rows = await prisma.systemSetting.findMany({
    where: { key: { in: [LAB_NAME_KEY, LAB_LOGO_URL_KEY] } },
  });
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const name = (map.get(LAB_NAME_KEY) ?? "").trim() || DEFAULT_LAB_NAME;
  const logo = (map.get(LAB_LOGO_URL_KEY) ?? "").trim();
  return { name, logoUrl: logo || null };
}

export async function setLabName(name: string): Promise<void> {
  const value = name.trim() || DEFAULT_LAB_NAME;
  await prisma.systemSetting.upsert({
    where: { key: LAB_NAME_KEY },
    create: { key: LAB_NAME_KEY, value },
    update: { value },
  });
}

export async function setLabLogoUrl(logoUrl: string | null): Promise<void> {
  const value = (logoUrl ?? "").trim();
  if (!value) {
    await prisma.systemSetting.deleteMany({ where: { key: LAB_LOGO_URL_KEY } });
    return;
  }
  await prisma.systemSetting.upsert({
    where: { key: LAB_LOGO_URL_KEY },
    create: { key: LAB_LOGO_URL_KEY, value },
    update: { value },
  });
}
