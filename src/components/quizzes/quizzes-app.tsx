"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

interface Subject {
  id: string;
  name: string;
}
interface Quiz {
  id: string;
  title: string;
}
interface Question {
  id: string;
  prompt: string;
  options: string[];
  correct_index: number;
  explanation: string;
}

export function QuizzesApp({ quizzes, subjects }: { quizzes: Quiz[]; subjects: Subject[] }) {
  const t = useTranslations("Quizzes");
  const router = useRouter();
  const [subjectId, setSubjectId] = useState("");
  const [count, setCount] = useState(5);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<{ score: number; total: number } | null>(null);

  async function loadQuiz(id: string) {
    const r = await fetch(`/api/quizzes/${id}`);
    const d = await r.json();
    setActiveQuiz(d.quiz);
    setQuestions(d.questions);
    setAnswers({});
    setResult(null);
  }

  async function generate() {
    if (!subjectId || busy) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/quizzes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectId, count }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "error");
      router.refresh();
      await loadQuiz(d.quiz.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!activeQuiz) return;
    const r = await fetch(`/api/quizzes/${activeQuiz.id}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers }),
    });
    const d = await r.json();
    setResult({ score: d.score, total: d.total });
  }

  if (activeQuiz) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => {
            setActiveQuiz(null);
            router.refresh();
          }}
          className="text-sm text-muted hover:text-foreground"
        >
          {t("backToQuizzes")}
        </button>
        <h2 className="text-xl font-semibold">{activeQuiz.title}</h2>

        {!result ? (
          <>
            <div className="space-y-4">
              {questions.map((q, qi) => (
                <div key={q.id} className="rounded-2xl border border-border bg-card p-4">
                  <p className="font-medium">
                    {qi + 1}. {q.prompt}
                  </p>
                  <div className="mt-3 space-y-2">
                    {q.options.map((opt, oi) => (
                      <label
                        key={oi}
                        className={
                          "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm " +
                          (answers[q.id] === oi ? "border-accent bg-accent/10" : "border-border")
                        }
                      >
                        <input
                          type="radio"
                          name={q.id}
                          checked={answers[q.id] === oi}
                          onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: oi }))}
                        />
                        {opt}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={submit}
              disabled={Object.keys(answers).length < questions.length}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
            >
              {t("submit")}
            </button>
          </>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-6 text-center">
              <p className="text-3xl font-semibold">
                {result.score}/{result.total}
              </p>
              <p className="text-muted">{t("score")}</p>
            </div>
            {questions.map((q, qi) => {
              const correct = answers[q.id] === q.correct_index;
              return (
                <div key={q.id} className="rounded-2xl border border-border bg-card p-4">
                  <p className="font-medium">
                    {qi + 1}. {q.prompt}
                  </p>
                  <p className={"mt-2 text-sm " + (correct ? "text-green-600" : "text-red-500")}>
                    {correct ? t("correct") : t("incorrect")}
                  </p>
                  {q.explanation && (
                    <p className="mt-2 text-sm text-muted">
                      <span className="font-medium">{t("explanation")}:</span> {q.explanation}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-4">
        <select
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="">{t("selectSubject")}</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
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
