"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

interface PageText {
  page_number: number;
  status: string;
  error: string | null;
  text: string | null;
  image_url: string | null;
}

interface TocEntry {
  id: string;
  title: string;
  level: number;
  printed_page: number;
  pdf_page_start: number;
  pdf_page_end: number | null;
  topic_name: string | null;
}

export function MaterialPdfPreview({
  materialId,
  filename,
  pageCount,
}: {
  materialId: string;
  filename: string;
  pageCount: number | null;
}) {
  const t = useTranslations("Subjects");
  const tc = useTranslations("Common");
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageData, setPageData] = useState<PageText | null>(null);
  const [toc, setToc] = useState<TocEntry[]>([]);
  const [showText, setShowText] = useState(false);

  const total = pageCount ?? 0;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "ArrowLeft") setPage((p) => Math.max(1, p - 1));
      if (e.key === "ArrowRight" && total > 0) setPage((p) => Math.min(total, p + 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, total]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch(`/api/materials/${materialId}/toc`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { entries: [] }))
      .then((d) => {
        if (!cancelled) setToc((d.entries as TocEntry[]) ?? []);
      })
      .catch(() => {
        if (!cancelled) setToc([]);
      });
    return () => {
      cancelled = true;
    };
  }, [materialId, open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch(`/api/materials/${materialId}/pages/${page}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled) setPageData(d as PageText | null);
      })
      .catch(() => {
        if (!cancelled) setPageData(null);
      });
    return () => {
      cancelled = true;
    };
  }, [materialId, open, page]);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setPage(1);
          setOpen(true);
        }}
        title={t("preview")}
        aria-label={t("preview")}
        className="flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-border bg-foreground/5 text-[10px] font-semibold uppercase tracking-wide text-muted transition-colors hover:border-accent hover:text-accent"
      >
        PDF
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/85 p-2 sm:p-4"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={filename}
        >
          <div
            className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{filename}</p>
                <p className="text-xs text-muted">{t("pageOf", { page, total: total || "?" })}</p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded-md px-2 py-1 text-sm text-muted transition hover:bg-foreground/5 hover:text-foreground disabled:opacity-40"
                >
                  {t("previousPage")}
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(total || p + 1, p + 1))}
                  disabled={total === 0 || page >= total}
                  className="rounded-md px-2 py-1 text-sm text-muted transition hover:bg-foreground/5 hover:text-foreground disabled:opacity-40"
                >
                  {t("nextPage")}
                </button>
                <button
                  type="button"
                  onClick={() => setShowText((v) => !v)}
                  className="rounded-md px-2 py-1 text-sm text-muted transition hover:bg-foreground/5 hover:text-foreground"
                >
                  {t("pageText")}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md px-2 py-1 text-sm text-muted transition hover:bg-foreground/5 hover:text-foreground"
                >
                  {tc("close")}
                </button>
              </div>
            </div>

            {toc.length > 0 && (
              <div className="flex gap-1 overflow-x-auto border-b border-border px-2 py-1.5">
                {toc.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => setPage(entry.pdf_page_start)}
                    className={
                      "shrink-0 rounded-md px-2 py-1 text-xs transition-colors " +
                      (page >= entry.pdf_page_start &&
                      (entry.pdf_page_end === null || page <= entry.pdf_page_end)
                        ? "bg-accent/10 text-accent"
                        : "text-muted hover:bg-foreground/5 hover:text-foreground")
                    }
                    title={`${entry.title} · str. ${entry.printed_page}`}
                  >
                    {entry.title}
                  </button>
                ))}
              </div>
            )}

            <div className="min-h-0 flex-1 bg-muted/10">
              <iframe
                key={`${materialId}-${page}`}
                src={`/api/materials/${materialId}#page=${page}`}
                title={filename}
                className="h-full w-full border-0"
              />
            </div>

            {showText && (
              <div className="max-h-56 overflow-auto border-t border-border p-3 text-sm">
                {pageData?.text ? (
                  <pre className="whitespace-pre-wrap break-words font-sans">{pageData.text}</pre>
                ) : (
                  <p className="text-muted">{t("noPageText")}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
