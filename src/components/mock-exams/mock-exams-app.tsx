"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { SubjectSelect, type SubjectOption } from "@/components/ui/subject-select";
import { GenerationScopePicker } from "@/components/ui/generation-scope-picker";
import { DeleteButton } from "@/components/subjects/delete-button";
import { useJob } from "@/lib/use-jobs";
import { QuizRunner, type RunnerQuestion } from "@/components/quizzes/quiz-runner";

interface Exam {
  id: string;
  title: string;
  duration_min: number;
}

export function MockExamsApp({
  exams,
  subjects,
}: {
  exams: Exam[];
  subjects: SubjectOption[];
}) {
  const t = useTranslations("MockExams");
  const router = useRouter();
  const [subjectId, setSubjectId] = useState("");
  const [topicIds, setTopicIds] = useState<string[]>([]);
  const [columnIds, setColumnIds] = useState<string[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [count, setCount] = useState(10);
  const [duration, setDuration] = useState(30);
  const [busy, setBusy] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [active, setActive] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<RunnerQuestion[]>([]);

  useJob(jobId, (settled) => {
    if (settled.status === "done") {
      setJobId(null);
      setBusy(false);
      router.refresh();
    } else {
      setJobId(null);
      setBusy(false);
      setError(settled.error ?? "error");
    }
  });

  async function generate() {
    if (!subjectId || busy) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/quizzes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectId,
          count,
          durationMin: duration,
          topicIds,
          columnIds,
          keywords,
        }),
      });
      const d = (await r.json()) as { job?: { id: string }; error?: string };
      if (!r.ok || !d.job) throw new Error(d.error || "error");
      setJobId(d.job.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  async function start(exam: Exam) {
    const r = await fetch(`/api/quizzes/${exam.id}`);
    const d = await r.json();
    setActive(d.quiz);
    setQuestions(d.questions);
  }

  if (active) {
    return (
      <QuizRunner
        quiz={active}
        questions={questions}
        durationMin={active.duration_min}
        backLabel={t("back")}
        onExit={() => {
          setActive(null);
          router.refresh();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-4">
        <SubjectSelect
          value={subjectId}
          onChange={(v) => {
            setSubjectId(v);
            setTopicIds([]);
            setColumnIds([]);
            setKeywords([]);
          }}
          subjects={subjects}
          placeholder={t("selectSubject")}
        />
        <input
          type="number"
          min={1}
          max={30}
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
          className="w-24 rounded-lg border border-border bg-background px-3 py-2 text-sm"
          aria-label={t("questions")}
        />
        <input
          type="number"
          min={1}
          max={180}
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
          className="w-24 rounded-lg border border-border bg-background px-3 py-2 text-sm"
          aria-label={t("duration")}
        />
        <button
          onClick={generate}
          disabled={busy || !subjectId}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
        >
          {busy ? t("generating") : t("generate")}
        </button>
        {error && <span className="text-sm text-red-500">{error}</span>}
      </div>

      <GenerationScopePicker
        subjectId={subjectId}
        topicIds={topicIds}
        onTopicIdsChange={setTopicIds}
        columnIds={columnIds}
        onColumnIdsChange={setColumnIds}
        keywords={keywords}
        onKeywordsChange={setKeywords}
      />

      {exams.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-muted">
          {t("empty")}
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {exams.map((exam) => (
            <li key={exam.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-3">
                <button
                  onClick={() => void start(exam)}
                  className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left font-medium hover:text-accent"
                >
                  <span className="min-w-0 truncate">{exam.title}</span>
                  <span className="shrink-0 rounded-full bg-foreground/5 px-2 py-0.5 text-xs font-medium text-muted">
                    {exam.duration_min} {t("minutes")}
                  </span>
                </button>
                <DeleteButton href={`/api/quizzes/${exam.id}`} label={t("deleteExam")} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
