"use client";

import { useTranslations } from "next-intl";
import { ContainerPicker } from "@/components/ui/container-picker";
import { DifficultyPicker } from "@/components/ui/difficulty-picker";
import { KeywordPicker } from "@/components/ui/keyword-picker";
import { TopicPicker } from "@/components/ui/topic-picker";
import type { GenerationDifficulty } from "@/lib/generation";

export function GenerationScopePicker({
  subjectId,
  topicIds,
  onTopicIdsChange,
  columnIds,
  onColumnIdsChange,
  keywords,
  onKeywordsChange,
  difficulty,
  onDifficultyChange,
  customPrompt,
  onCustomPromptChange,
}: {
  subjectId: string;
  topicIds: string[];
  onTopicIdsChange: (ids: string[]) => void;
  columnIds: string[];
  onColumnIdsChange: (ids: string[]) => void;
  keywords: string[];
  onKeywordsChange: (keywords: string[]) => void;
  difficulty?: GenerationDifficulty;
  onDifficultyChange?: (difficulty: GenerationDifficulty) => void;
  customPrompt?: string;
  onCustomPromptChange?: (customPrompt: string) => void;
}) {
  const t = useTranslations("Subjects");

  if (!subjectId) return null;

  return (
    <div className="space-y-2 rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-muted">{t("board")}</span>
        <ContainerPicker subjectId={subjectId} selected={columnIds} onChange={onColumnIdsChange} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-muted">{t("topics")}</span>
        <TopicPicker subjectId={subjectId} selected={topicIds} onChange={onTopicIdsChange} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-muted">{t("keywordsLabel")}</span>
        <KeywordPicker value={keywords} onChange={onKeywordsChange} />
      </div>
      {difficulty && onDifficultyChange && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-muted">{t("difficultyLabel")}</span>
          <DifficultyPicker value={difficulty} onChange={onDifficultyChange} />
        </div>
      )}
      {onCustomPromptChange && (
        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted" htmlFor="generation-custom-prompt">
            {t("customPromptLabel")}
          </label>
          <textarea
            id="generation-custom-prompt"
            value={customPrompt ?? ""}
            onChange={(e) => onCustomPromptChange(e.target.value)}
            placeholder={t("customPromptPlaceholder")}
            maxLength={2000}
            rows={3}
            className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-ring"
          />
        </div>
      )}
    </div>
  );
}
