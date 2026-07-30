"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { BookOpen, RefreshCw, Shield } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { AdminOnlyBadge } from "@/components/knowledge/admin-only-badge";
import {
  publishLabTeamCapabilitiesAction,
} from "@/plugins/team/capabilities-actions";
import { formatDate } from "@/lib/utils";

export function TeamCapabilitiesPanel({
  initialArticleId,
  initialUpdatedAt,
}: {
  initialArticleId: string | null;
  initialUpdatedAt: string | null;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [articleId, setArticleId] = useState(initialArticleId);
  const [updatedAt, setUpdatedAt] = useState(initialUpdatedAt);

  function refresh() {
    start(async () => {
      setError("");
      setInfo("");
      const result = await publishLabTeamCapabilitiesAction();
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setArticleId(result.articleId);
      setUpdatedAt(new Date().toISOString());
      setInfo(
        result.created
          ? "Mapa de capacidades criado na base de conhecimento."
          : "Mapa de capacidades atualizado.",
      );
    });
  }

  return (
    <Card className="mb-6 border-amber-500/20 bg-amber-500/5 p-5">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Shield size={16} className="text-amber-600" />
        <h2 className="text-sm font-semibold">Mapa de capacidades da equipe</h2>
        <AdminOnlyBadge />
      </div>
      <p className="mb-4 text-xs text-muted">
        Gera um artigo global na base de conhecimento com perfil e atividades de cada integrante.
        Visivel apenas para administradores. Util para alocar pessoas em novos projetos e sugerir
        responsaveis por tarefa.
      </p>

      {articleId && updatedAt && (
        <p className="mb-3 text-xs text-muted">
          Ultima atualizacao: {formatDate(updatedAt)}
          {" · "}
          <Link href={`/knowledge/${articleId}`} className="text-brand hover:underline">
            Ver artigo
          </Link>
        </p>
      )}

      {error && <p className="mb-3 text-sm text-red-500">{error}</p>}
      {info && <p className="mb-3 text-sm text-brand">{info}</p>}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={pending} onClick={refresh}>
          <RefreshCw size={14} /> {pending ? "Gerando..." : articleId ? "Atualizar mapa" : "Gerar mapa"}
        </Button>
        {articleId && (
          <Link href={`/knowledge/${articleId}`}>
            <Button size="sm" variant="outline">
              <BookOpen size={14} /> Abrir na base
            </Button>
          </Link>
        )}
      </div>
    </Card>
  );
}
