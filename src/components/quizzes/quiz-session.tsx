"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MaterialPreviewModal } from "@/components/ui/material-preview-modal";
import { SourceChips } from "@/components/ui/source-chips";
import { parseSourceRefs, type SourceRef } from "@/lib/list-view";
import { QuizRunner, clearQuizSession, type RunnerQuestion } from "./quiz-runner";

export function QuizSession({
  quiz,
  questions,
  subjectId,
}: {
  quiz: { id: string; title: string; duration_min: number | null; source_refs: string | null };
  questions: RunnerQuestion[];
  subjectId: string;
}) {
  const t = useTranslations("Quizzes");
  const tc = useTranslations("Common");
  const router = useRouter();
  const [started, setStarted] = useState(false);
  const [runId, setRunId] = useState(0);
  const [openMaterial, setOpenMaterial] = useState<{ id: string; page?: number } | null>(null);
  const sources = parseSourceRefs(quiz.source_refs);

  function openSource(source: SourceRef) {
    setOpenMaterial({ id: source.materialId, page: source.pageStart });
  }

  function retake() {
    clearQuizSession(quiz.id);
    setRunId((n) => n + 1);
    setStarted(true);
  }

  return (
    <div className="space-y-5">
      {sources.length > 0 && (
        <Card className="p-4">
          <h2 className="text-sm font-semibold">{tc("sources")}</h2>
          <SourceChips value={quiz.source_refs} subjectId={subjectId} onOpen={openSource} />
        </Card>
      )}

      {!started ? (
        <Card className="p-5">
          <p className="text-sm text-muted">{t("subtitle")}</p>
          <Button className="mt-4" onClick={() => setStarted(true)}>
            {t("take")}
          </Button>
        </Card>
      ) : (
        <QuizRunner
          key={`${quiz.id}-${runId}`}
          quiz={{ id: quiz.id, title: quiz.title }}
          questions={questions}
          durationMin={quiz.duration_min}
          backLabel={t("backToQuizzes")}
          onExit={() => router.push("/quizzes")}
          onRetake={retake}
        />
      )}

      <MaterialPreviewModal
        materialId={openMaterial?.id ?? null}
        page={openMaterial?.page}
        onClose={() => setOpenMaterial(null)}
      />
    </div>
  );
}
