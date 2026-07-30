"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FlaskConical, Trash2, Upload } from "lucide-react";
import { Button, Card, Input, Label } from "@/components/ui";
import {
  removeLabLogoAction,
  saveLabNameAction,
  uploadLabLogoAction,
} from "@/app/actions/lab-branding";
import type { LabBranding } from "@/lib/lab-branding-shared";

export function LabBrandingPanel({ initial }: { initial: LabBranding }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(initial.name);
  const [logoUrl, setLogoUrl] = useState(initial.logoUrl);
  const [info, setInfo] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function saveName() {
    setError("");
    setInfo("");
    start(async () => {
      const res = await saveLabNameAction(name);
      if (res.error) {
        setError(res.error);
        return;
      }
      setInfo("Nome salvo.");
      router.refresh();
    });
  }

  function onUpload(file: File | null) {
    if (!file) return;
    setError("");
    setInfo("");
    const fd = new FormData();
    fd.set("logo", file);
    start(async () => {
      const res = await uploadLabLogoAction(fd);
      if (res.error) {
        setError(res.error);
        return;
      }
      if (res.logoUrl) setLogoUrl(res.logoUrl.split("?")[0] ?? res.logoUrl);
      setInfo("Logo atualizado.");
      router.refresh();
    });
  }

  function removeLogo() {
    setError("");
    setInfo("");
    start(async () => {
      const res = await removeLabLogoAction();
      if (res.error) {
        setError(res.error);
        return;
      }
      setLogoUrl(null);
      setInfo("Logo removido.");
      router.refresh();
    });
  }

  return (
    <Card className="space-y-4 p-5">
      <div>
        <h2 className="text-sm font-semibold">Laboratorio</h2>
        <p className="mt-0.5 text-xs text-muted">
          Nome e logo exibidos na barra superior. Visivel para todos os usuarios.
        </p>
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-brand text-brand-fg">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <FlaskConical size={28} />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <Label htmlFor="lab-name">Nome do laboratorio</Label>
            <div className="mt-1 flex flex-wrap gap-2">
              <Input
                id="lab-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                className="max-w-sm"
              />
              <Button type="button" disabled={pending} onClick={saveName}>
                Salvar nome
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              onChange={(e) => {
                onUpload(e.target.files?.[0] ?? null);
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => fileRef.current?.click()}
            >
              <Upload size={14} /> Enviar logo
            </Button>
            {logoUrl && (
              <Button type="button" variant="outline" disabled={pending} onClick={removeLogo}>
                <Trash2 size={14} /> Remover logo
              </Button>
            )}
          </div>
          <p className="text-[11px] text-muted">PNG, JPEG, WebP ou SVG — ate 1 MB.</p>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {info && <p className="text-sm text-brand">{info}</p>}
    </Card>
  );
}
