"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

interface Subject {
  id: string;
  name: string;
}
interface Exercise {
  id: string;
  prompt: string;
  solution_steps: string[];
  difficulty: string;
}
interface TrueFalseItem {
  id: string;
  statement: string;
  is_correct: boolean;
  explanation: string;
}

export function PracticeApp({
  exercises,
  items,
  subjects,
}: {
  exercises: Exercise[];
  items: TrueFalseItem[];
  subjects: Subject[];
}) {
  const t = useTranslations("Practice");
  const router = useRouter();
  const [tab, setTab] = useState<"exercises" | "truefalse">("exercises");
  const [subjectId, setSubjectId] = useState("");
  const [count, setCount] = useState(5);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [tfAnswers, setTfAnswers] = useState<Record<string, boolean>>({});

  async function generate(kind: "exercises" | "truefalse") {
    if (!subjectId || busy) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectId, count }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "error");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove(kind: "exercises" | "truefalse", id: string) {
    await fetch(`/api/${kind}/${id}`, { method: "DELETE" });
    router.refresh();
  }

  function difficultyLabel(d: string) {
    if (d === "easy") return t("easy");
    if (d === "hard") return t("hard");
    return t("medium");
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
          max={20}
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
          className="w-24 rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
        <button
          onClick={() => generate("exercises")}
          disabled={busy || !subjectId}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
        >
          {busy ? t("generating") : t("generateExercises")}
        </button>
        <button
          onClick={() => generate("truefalse")}
          disabled={busy || !subjectId}
          className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {t("generateTrueFalse")}
        </button>
        {error && <span className="text-sm text-red-500">{error}</span>}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setTab("exercises")}
          className={
            "rounded-lg px-3 py-1.5 text-sm font-medium " +
            (tab === "exercises" ? "bg-accent text-accent-foreground" : "border border-border")
          }
        >
          {t("exercises")}
        </button>
        <button
          onClick={() => setTab("truefalse")}
          className={
            "rounded-lg px-3 py-1.5 text-sm font-medium " +
            (tab === "truefalse" ? "bg-accent text-accent-foreground" : "border border-border")
          }
        >
          {t("trueFalse")}
        </button>
      </div>

      {tab === "exercises" ? (
        exercises.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-muted">
            {t("emptyExercises")}
          </div>
        ) : (
          <div className="space-y-3">
            {exercises.map((ex) => (
              <div key={ex.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium">{ex.prompt}</p>
                  <button
                    onClick={() => remove("exercises", ex.id)}
                    className="shrink-0 text-xs text-muted hover:text-red-500"
                    title={t("deleteExercise")}
                    aria-label={t("deleteExercise")}
                  >
                    ✕
                  </button>
                </div>
                <div className="mt-2">
                  <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent">
                    {difficultyLabel(ex.difficulty)}
                  </span>
                </div>
                <button
                  onClick={() => setRevealed((p) => ({ ...p, [ex.id]: !p[ex.id] }))}
                  className="mt-3 text-sm text-accent hover:underline"
                >
                  {revealed[ex.id] ? t("hideSolution") : t("showSolution")}
                </button>
                {revealed[ex.id] && (
                  <div className="mt-3 rounded-xl bg-background p-3">
                    <p className="mb-2 text-sm font-medium text-muted">{t("solution")}</p>
                    <ol className="list-decimal space-y-1 pl-5 text-sm">
                      {ex.solution_steps.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-muted">
          {t("emptyTrueFalse")}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const answered = item.id in tfAnswers;
            const correct = tfAnswers[item.id] === item.is_correct;
            const btnClass = (value: boolean) => {
              if (!answered) return "border-border hover:border-accent";
              if (value === item.is_correct)
                return "border-green-500 bg-green-500/10 text-green-600";
              if (tfAnswers[item.id] === value)
                return "border-red-500 bg-red-500/10 text-red-500";
              return "border-border opacity-60";
            };
            return (
              <div key={item.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium">{item.statement}</p>
                  <button
                    onClick={() => remove("truefalse", item.id)}
                    className="shrink-0 text-xs text-muted hover:text-red-500"
                    title={t("deleteItem")}
                    aria-label={t("deleteItem")}
                  >
                    ✕
                  </button>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => setTfAnswers((p) => ({ ...p, [item.id]: true }))}
                    disabled={answered}
                    className={
                      "rounded-lg border px-4 py-1.5 text-sm font-medium disabled:opacity-70 " +
                      btnClass(true)
                    }
                  >
                    {t("true")}
                  </button>
                  <button
                    onClick={() => setTfAnswers((p) => ({ ...p, [item.id]: false }))}
                    disabled={answered}
                    className={
                      "rounded-lg border px-4 py-1.5 text-sm font-medium disabled:opacity-70 " +
                      btnClass(false)
                    }
                  >
                    {t("false")}
                  </button>
                </div>
                {answered && (
                  <div className="mt-3">
                    <p
                      className={
                        "text-sm font-medium " + (correct ? "text-green-600" : "text-red-500")
                      }
                    >
                      {correct ? t("correct") : t("incorrect")}
                    </p>
                    {item.explanation && (
                      <p className="mt-1 text-sm text-muted">
                        <span className="font-medium">{t("explanation")}:</span> {item.explanation}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
