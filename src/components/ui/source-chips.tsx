"use client";

import { useTranslations } from "next-intl";
import { parseSourceRefs, sourceLabel, type SourceRef } from "@/lib/list-view";

export function SourceChips({
  value,
  subjectId,
  onOpen,
}: {
  value: string | null | undefined;
  subjectId?: string | null;
  onOpen?: (source: SourceRef) => void;
}) {
  const t = useTranslations("Common");
  const sources = parseSourceRefs(value).slice(0, 3);
  if (sources.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-1" aria-label={t("sources")}>
      {sources.map((source, index) => {
        const label = sourceLabel(source);
        const className =
          "rounded-full bg-foreground/5 px-2 py-0.5 text-[11px] text-muted transition hover:bg-accent/10 hover:text-accent";
        if (onOpen) {
          return (
            <button
              key={`${source.materialId}-${index}`}
              type="button"
              onClick={() => onOpen(source)}
              className={className}
              title={source.filename}
            >
              {label}
            </button>
          );
        }
        return (
          <a
            key={`${source.materialId}-${index}`}
            href={subjectId ? `/subjects/${subjectId}#material-${source.materialId}` : "/subjects"}
            className={className}
            title={source.filename}
          >
            {label}
          </a>
        );
      })}
    </div>
  );
}
