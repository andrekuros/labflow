"use server";

import { revalidatePath } from "next/cache";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { requireAdmin } from "@/lib/rbac";
import { getLabBranding, setLabLogoUrl, setLabName, type LabBranding } from "@/lib/lab-branding";

const MAX_BYTES = 1_000_000;
const ALLOWED: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
};

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

export async function getLabBrandingAction(): Promise<LabBranding> {
  await requireAdmin();
  return getLabBranding();
}

export async function saveLabNameAction(name: string): Promise<{ error?: string }> {
  await requireAdmin();
  const trimmed = name.trim();
  if (!trimmed) return { error: "Informe o nome do laboratorio." };
  if (trimmed.length > 80) return { error: "Nome muito longo (max. 80)." };
  await setLabName(trimmed);
  revalidatePath("/", "layout");
  revalidatePath("/settings");
  return {};
}

export async function uploadLabLogoAction(formData: FormData): Promise<{ error?: string; logoUrl?: string }> {
  await requireAdmin();
  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Selecione um arquivo de imagem." };
  }
  if (file.size > MAX_BYTES) return { error: "Arquivo muito grande (max. 1 MB)." };
  const ext = ALLOWED[file.type];
  if (!ext) return { error: "Formato invalido. Use PNG, JPEG, WebP ou SVG." };

  await mkdir(UPLOAD_DIR, { recursive: true });

  // Remove previous logo files (any extension)
  const branding = await getLabBranding();
  if (branding.logoUrl?.startsWith("/uploads/")) {
    const prev = path.join(process.cwd(), "public", branding.logoUrl.replace(/^\//, ""));
    try {
      await unlink(prev);
    } catch {
      /* ignore missing */
    }
  }

  const filename = `lab-logo${ext}`;
  const dest = path.join(UPLOAD_DIR, filename);
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(dest, buf);

  const logoUrl = `/uploads/${filename}`;
  await setLabLogoUrl(logoUrl);
  revalidatePath("/", "layout");
  revalidatePath("/settings");
  return { logoUrl };
}

export async function removeLabLogoAction(): Promise<{ error?: string }> {
  await requireAdmin();
  const branding = await getLabBranding();
  if (branding.logoUrl?.startsWith("/uploads/")) {
    const prev = path.join(process.cwd(), "public", branding.logoUrl.replace(/^\//, ""));
    try {
      await unlink(prev);
    } catch {
      /* ignore */
    }
  }
  await setLabLogoUrl(null);
  revalidatePath("/", "layout");
  revalidatePath("/settings");
  return {};
}
