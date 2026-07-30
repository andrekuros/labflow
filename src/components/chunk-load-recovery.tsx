"use client";

import { useEffect } from "react";

/** Recarrega a pagina quando chunks de um deploy antigo falham ao carregar. */
export function ChunkLoadRecovery() {
  useEffect(() => {
    function shouldReload(reason: unknown) {
      const msg = reason instanceof Error ? reason.message : String(reason ?? "");
      return (
        (reason instanceof Error && reason.name === "ChunkLoadError") ||
        msg.includes("Loading chunk") ||
        msg.includes("ChunkLoadError")
      );
    }

    function onRejection(event: PromiseRejectionEvent) {
      if (!shouldReload(event.reason)) return;
      event.preventDefault();
      window.location.reload();
    }

    function onError(event: ErrorEvent) {
      if (!shouldReload(event.error ?? event.message)) return;
      event.preventDefault();
      window.location.reload();
    }

    window.addEventListener("unhandledrejection", onRejection);
    window.addEventListener("error", onError);
    return () => {
      window.removeEventListener("unhandledrejection", onRejection);
      window.removeEventListener("error", onError);
    };
  }, []);

  return null;
}
