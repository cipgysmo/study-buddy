"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TopicPicker } from "@/components/ui/topic-picker";
import { useJob } from "@/lib/use-jobs";

/**
 * Build a guided lesson from a subject's (optionally topic-filtered) notes.
 * Enqueues a background job, polls it, then opens the finished lesson.
 */
export function BuildLessonButton({ subjectId }: { subjectId: string }) {
  const t = useTranslations("Lessons");
  const router = useRouter();
  const [topicIds, setTopicIds] = useState<string[]>([]);
  const [jobId, setJobId] = useState<string | null>(null);
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const busy = jobId !== null;

  useJob(jobId, (job) => {
    setJobId(null);
    if (job.status === "done") {
      if (lessonId) router.push(`/lessons/${lessonId}`);
      else router.refresh();
    } else {
      setError(job.error ?? "error");
    }
  });

  async function build() {
    if (busy) return;
    setError("");
    try {
      const r = await fetch(`/api/subjects/${subjectId}/lessons`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicIds }),
      });
      const d = (await r.json()) as { lesson?: { id: string }; job?: { id: string }; error?: string };
      if (!r.ok || !d.job || !d.lesson) throw new Error(d.error ?? "error");
      setLessonId(d.lesson.id);
      setJobId(d.job.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <Card className="space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => void build()} disabled={busy}>
          {busy ? t("building") : t("newLesson")}
        </Button>
        <span className="text-xs text-muted">{t("buildHint")}</span>
        {error && <span className="text-xs text-danger">{error}</span>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted">{t("topicsLabel")}</span>
        <TopicPicker subjectId={subjectId} selected={topicIds} onChange={setTopicIds} />
      </div>
    </Card>
  );
}
