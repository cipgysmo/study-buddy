"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

export function MaterialImage({ src, alt }: { src: string; alt: string }) {
  const t = useTranslations("Common");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={alt}
        className="h-12 w-12 shrink-0 cursor-zoom-in overflow-hidden rounded-lg border border-border bg-muted/20"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- same-origin API serves pre-sized thumbnails; next/image adds no value */}
        <img
          src={`${src}?thumb=1`}
          alt={alt}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={alt}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- full-size original, dimensions unknown until load */}
          <img
            src={src}
            alt={alt}
            className="max-h-full max-w-full rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute right-4 top-4 rounded-full bg-white/10 px-3 py-1.5 text-sm text-white transition-colors hover:bg-white/20"
          >
            {t("close")}
          </button>
        </div>
      )}
    </>
  );
}
