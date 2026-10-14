"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

interface MaterialMeta {
  id: string;
  subject_id: string;
  filename: string;
  mime: string;
  kind: "pdf" | "image" | "text";
  page_count: number | null;
  status: string;
}

export function MaterialPreviewModal({
  materialId,
  page,
  onClose,
}: {
  materialId: string | null;
  page?: number;
  onClose: () => void;
}) {
  const t = useTranslations("Common");
  const [meta, setMeta] = useState<MaterialMeta | null>(null);
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    if (!materialId) return;
    let cancelled = false;
    fetch(`/api/materials/${materialId}/meta`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        const m = (d as { material?: MaterialMeta } | null)?.material ?? null;
        setMeta(m);
        if (m?.kind === "text") {
          fetch(`/api/materials/${materialId}`, { cache: "no-store" })
            .then((r) => r.text())
            .then((body) => {
              if (!cancelled) setText(body.slice(0, 20000));
            });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [materialId]);

  useEffect(() => {
    if (!materialId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [materialId, onClose]);

  if (!materialId) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/85 p-2 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={meta?.filename ?? "Material"}
    >
      <div
        className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2">
          <p className="min-w-0 truncate text-sm font-medium">{meta?.filename ?? "…"}</p>
          <button
            type="button"
            onClick={onClose}
            className="min-h-10 rounded-lg px-3 text-sm text-muted transition hover:bg-foreground/5 hover:text-foreground"
          >
            {t("close")}
          </button>
        </div>
        <div className="min-h-0 flex-1 bg-muted/10 p-3">
          {meta?.kind === "pdf" && (
            <iframe
              src={`/api/materials/${materialId}${page ? `#page=${page}` : ""}`}
              title={meta.filename}
              className="h-full w-full rounded-lg border-0"
            />
          )}
          {meta?.kind === "image" && (
            // eslint-disable-next-line @next/next/no-img-element -- direct material preview
            <img
              src={`/api/materials/${materialId}`}
              alt={meta.filename}
              className="mx-auto max-h-full max-w-full rounded-lg"
            />
          )}
          {meta?.kind === "text" && (
            <pre className="h-full overflow-auto whitespace-pre-wrap break-words rounded-lg bg-background p-3 text-sm">
              {text ?? "…"}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
