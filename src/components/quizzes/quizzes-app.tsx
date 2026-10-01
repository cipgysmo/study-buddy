"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { SubjectSelect, type SubjectOption } from "@/components/ui/subject-select";
import { TopicPicker } from "@/components/ui/topic-picker";
import { useJob } from "@/lib/use-jobs";
import { QuizRunner, type RunnerQuestion } from "./quiz-runner";

interface Quiz {
  id: string;
  title: string;
}

export function QuizzesApp({
  quizzes,
  subjects,
}: {
  quizzes: Quiz[];
  subjects: SubjectOption[];
}) {
  const t = useTranslations("Quizzes");
  const router = useRouter();
  const [subjectId, setSubjectId] = useState("");
  const [topicIds, setTopicIds] = useState<string[]>([]);
  const [count, setCount] = useState(5);
  const [busy, setBusy] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
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

  async function loadQuiz(id: string) {
    const r = await fetch(`/api/quizzes/${id}`);
    const d = await r.json();
    setActiveQuiz(d.quiz);
    setQuestions(d.questions);
  }

  async function generate() {
    if (!subjectId || busy) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/quizzes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectId, count, topicIds }),
      });
      const d = (await r.json()) as { job?: { id: string }; error?: string };
      if (!r.ok || !d.job) throw new Error(d.error || "error");
      setJobId(d.job.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  if (activeQuiz) {
    return (
      <QuizRunner
        quiz={activeQuiz}
        questions={questions}
        backLabel={t("backToQuizzes")}
        onExit={() => {
          setActiveQuiz(null);
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

      <TopicPicker subjectId={subjectId} selected={topicIds} onChange={setTopicIds} />

      {quizzes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-muted">
          {t("empty")}
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {quizzes.map((q) => (
            <li key={q.id} className="rounded-2xl border border-border bg-card p-4">
              <button onClick={() => loadQuiz(q.id)} className="font-medium hover:text-accent">
                {q.title}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
