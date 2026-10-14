"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

const SESSION_KEY = "study-buddy:practice-session:v1";

interface Session {
  revealed: Record<string, boolean>;
  tfAnswers: Record<string, boolean>;
  typedAnswers: Record<string, string>;
  typedResults?: Record<string, { correct: boolean }>;
}

interface Exercise {
  id: string;
}
interface TrueFalseItem {
  id: string;
  is_correct: boolean;
}
interface TypedExercise {
  id: string;
}

function loadSession(): Session {
  if (typeof window === "undefined") {
    return { revealed: {}, tfAnswers: {}, typedAnswers: {}, typedResults: {} };
  }
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return { revealed: {}, tfAnswers: {}, typedAnswers: {}, typedResults: {} };
    const parsed = JSON.parse(raw) as Partial<Session>;
    return {
      revealed: parsed.revealed ?? {},
      tfAnswers: parsed.tfAnswers ?? {},
      typedAnswers: parsed.typedAnswers ?? {},
      typedResults: parsed.typedResults ?? {},
    };
  } catch {
    return { revealed: {}, tfAnswers: {}, typedAnswers: {}, typedResults: {} };
  }
}

export function PracticeSessionProgress({
  exercises,
  items,
  typedExercises,
}: {
  exercises: Exercise[];
  items: TrueFalseItem[];
  typedExercises: TypedExercise[];
}) {
  const t = useTranslations("Practice");
  const [stats, setStats] = useState({ total: 0, answered: 0, correct: 0, remaining: 0 });

  useEffect(() => {
    function compute() {
      const session = loadSession();
      const total = exercises.length + items.length + typedExercises.length;
      const revealedExercises = exercises.filter((x) => session.revealed[x.id]).length;
      const answeredTrueFalse = items.filter((x) => x.id in session.tfAnswers).length;
      const answeredTyped = typedExercises.filter((x) => session.typedResults?.[x.id]).length;
      const correctTrueFalse = items.filter((x) => session.tfAnswers[x.id] === x.is_correct).length;
      const correctTyped = typedExercises.filter((x) => session.typedResults?.[x.id]?.correct).length;
      const answered = revealedExercises + answeredTrueFalse + answeredTyped;
      setStats({
        total,
        answered,
        correct: correctTrueFalse + correctTyped,
        remaining: Math.max(0, total - answered),
      });
    }

    compute();
    window.addEventListener("study-buddy:practice-session-updated", compute);
    return () => window.removeEventListener("study-buddy:practice-session-updated", compute);
  }, [exercises, items, typedExercises]);

  if (stats.total === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
      <span className="rounded-full bg-foreground/5 px-2 py-1">
        {t("answered", { answered: stats.answered, total: stats.total })}
      </span>
      <span className="rounded-full bg-success/10 px-2 py-1 text-success">
        {t("correctCount", { count: stats.correct })}
      </span>
      <span className="rounded-full bg-foreground/5 px-2 py-1">
        {t("remaining", { count: stats.remaining })}
      </span>
    </div>
  );
}
