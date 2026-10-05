"use client";

import { useTranslations } from "next-intl";
import { ContainerPicker } from "@/components/ui/container-picker";
import { KeywordPicker } from "@/components/ui/keyword-picker";
import { TopicPicker } from "@/components/ui/topic-picker";

export function GenerationScopePicker({
  subjectId,
  topicIds,
  onTopicIdsChange,
  columnIds,
  onColumnIdsChange,
  keywords,
  onKeywordsChange,
}: {
  subjectId: string;
  topicIds: string[];
  onTopicIdsChange: (ids: string[]) => void;
  columnIds: string[];
  onColumnIdsChange: (ids: string[]) => void;
  keywords: string[];
  onKeywordsChange: (keywords: string[]) => void;
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
    </div>
  );
}
