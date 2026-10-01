"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Confetti } from "@/components/ui/confetti";
import { Diagram } from "@/components/ui/diagram";
import { ExplainButton } from "@/components/ui/explain-button";
import { NavIcon } from "@/components/shell/nav-icons";
import { loadSoundSetting, playSound } from "@/lib/sound";

export interface RunnerQuestion {
  id: string;
  prompt: string;
  options: string[];
  correct_index: number;
  explanation: string;
  diagram?: string | null;
}

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Animates a number from 0 to `to` (ease-out). Isolated so only this re-renders. */
function CountUp({ to, duration = 900 }: { to: number; duration?: number }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(eased * to));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, duration]);
  return <>{val}</>;
}

/**
 * Shared quiz-taking UI. With `durationMin` it becomes a timed mock exam:
 * a countdown is shown and the exam auto-submits when time runs out.
 */
export function QuizRunner({
  quiz,
  questions,
  durationMin,
  backLabel,
  onExit,
}: {
  quiz: { id: string; title: string };
  questions: RunnerQuestion[];
  durationMin?: number | null;
  backLabel: string;
  onExit: () => void;
}) {
  const t = useTranslations("Quizzes");
  const tb = useTranslations("Progress");
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<{ score: number; total: number } | null>(null);
  const [newBadges, setNewBadges] = useState<{ id: string; icon: string }[]>([]);
  const [celebrate, setCelebrate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(
    durationMin ? durationMin * 60 : null
  );
  const submittedRef = useRef(false);

  const submit = useCallback(async () => {
    if (submittedRef.current || submitting) return;
    submittedRef.current = true;
    setSubmitting(true);
    const r = await fetch(`/api/quizzes/${quiz.id}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers }),
    });
    const d = (await r.json()) as {
      score: number;
      total: number;
      newAchievements?: { id: string; icon: string }[];
    };
    setResult({ score: d.score, total: d.total });
    setNewBadges(d.newAchievements ?? []);
    setCelebrate(true);
    void playSound(d.score / d.total >= 0.5 ? "fanfare" : "encourage");
  }, [quiz.id, answers, submitting]);

  const running = remaining !== null && result === null;

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      setRemaining((s) => (s === null ? s : Math.max(0, s - 1)));
    }, 1000);
    return () => clearInterval(timer);
  }, [running]);

  useEffect(() => {
    if (remaining === 0 && result === null) {
      void submit();
    }
  }, [remaining, result, submit]);

  useEffect(() => {
    void loadSoundSetting();
  }, []);

  const answeredCount = Object.keys(answers).length;

  if (result) {
    const ratio = result.score / result.total;
    const message =
      ratio >= 0.8 ? t("greatScore") : ratio >= 0.5 ? t("goodScore") : t("keepGoing");
    return (
      <div className="space-y-4">
        <Confetti active={celebrate} count={Math.round(40 + ratio * 100)} />
        <button onClick={onExit} className="text-sm text-muted hover:text-foreground">
          {backLabel}
        </button>
        <h2 className="text-xl font-semibold">{quiz.title}</h2>
        <div className="space-y-4">
          <div className="animate-pop-in rounded-2xl border border-border bg-card p-6 text-center">
            <p className="text-5xl font-semibold tabular-nums">
              <CountUp to={result.score} />
              <span className="text-2xl text-muted">/{result.total}</span>
            </p>
            <p className="mt-1 text-lg font-medium text-accent">{message}</p>
            <p className="text-muted">{t("score")}</p>
          </div>
          {newBadges.length > 0 && (
            <div className="animate-pop-in rounded-2xl border border-accent/40 bg-accent/5 p-4">
              <p className="text-sm font-medium text-accent">{tb("badgeUnlocked")}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {newBadges.map((b) => (
                  <span
                    key={b.id}
                    className="flex items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1 text-sm font-medium text-accent"
                  >
                    <NavIcon name={b.icon} className="h-4 w-4" />
                    {tb(`badge_${b.id}_name`)}
                  </span>
                ))}
              </div>
            </div>
          )}
          {questions.map((q, qi) => {
            const correct = answers[q.id] === q.correct_index;
            return (
              <div key={q.id} className="rounded-2xl border border-border bg-card p-4">
                <p className="font-medium">
                  {qi + 1}. {q.prompt}
                </p>
                {q.diagram && (
                  <div className="mt-3">
                    <Diagram svg={q.diagram} />
                  </div>
                )}
                <p className={"mt-2 text-sm " + (correct ? "text-success" : "text-danger")}>
                  {correct ? t("correct") : t("incorrect")}
                </p>
                {q.explanation && (
                  <p className="mt-2 text-sm text-muted">
                    <span className="font-medium">{t("explanation")}:</span> {q.explanation}
                  </p>
                )}
                <ExplainButton
                  question={{
                    prompt: q.prompt,
                    options: q.options,
                    answer: q.options[q.correct_index],
                    explanation: q.explanation,
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <button onClick={onExit} className="text-sm text-muted hover:text-foreground">
          {backLabel}
        </button>
        {remaining !== null && (
          <span
            className={
              "rounded-full px-3 py-1 text-sm font-semibold tabular-nums " +
              (remaining < 60 ? "bg-danger/10 text-danger" : "bg-foreground/5")
            }
          >
            {formatTime(remaining)}
          </span>
        )}
      </div>
      <h2 className="text-xl font-semibold">{quiz.title}</h2>

      <div className="space-y-4">
        {questions.map((q, qi) => (
          <div key={q.id} className="rounded-2xl border border-border bg-card p-4">
            <p className="font-medium">
              {qi + 1}. {q.prompt}
            </p>
            {q.diagram && (
              <div className="mt-3">
                <Diagram svg={q.diagram} />
              </div>
            )}
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
        onClick={() => void submit()}
        disabled={submitting || answeredCount === 0}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
      >
        {t("submit")}
      </button>
    </div>
  );
}
