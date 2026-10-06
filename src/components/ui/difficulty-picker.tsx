"use client";

import { useTranslations } from "next-intl";
import type { GenerationDifficulty } from "@/lib/generation";

const DIFFICULTIES: GenerationDifficulty[] = ["easy", "medium", "hard", "expert"];

export function DifficultyPicker({
  value,
  onChange,
}: {
  value: GenerationDifficulty;
  onChange: (value: GenerationDifficulty) => void;
}) {
  const t = useTranslations("Subjects");

  return (
    <div className="inline-flex flex-wrap rounded-xl border border-border bg-background p-1">
      {DIFFICULTIES.map((difficulty) => (
        <button
          key={difficulty}
          type="button"
          onClick={() => onChange(difficulty)}
          className={
            "min-h-8 rounded-lg px-3 py-1.5 text-sm font-medium transition " +
            (value === difficulty
              ? "bg-accent/10 text-accent ring-1 ring-accent/20"
              : "text-muted hover:text-foreground")
          }
        >
          {t(`difficulty${difficulty.charAt(0).toUpperCase()}${difficulty.slice(1)}`)}
        </button>
      ))}
    </div>
  );
}
