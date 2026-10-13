"use client";

import { useTranslations } from "next-intl";
import { parseSourceRefs, sourceLabel } from "@/lib/list-view";

export function SourceChips({ value }: { value: string | null | undefined }) {
  const t = useTranslations("Common");
  const sources = parseSourceRefs(value).slice(0, 3);
  if (sources.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-1" aria-label={t("sources")}>
      {sources.map((source, index) => (
        <a
          key={`${source.materialId}-${index}`}
          href={`/subjects/${source.materialId}`}
          className="rounded-full bg-foreground/5 px-2 py-0.5 text-[11px] text-muted transition hover:bg-accent/10 hover:text-accent"
          title={source.filename}
        >
          {sourceLabel(source)}
        </a>
      ))}
    </div>
  );
}
