"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { NavIcon } from "@/components/shell/nav-icons";
import { SubjectSelect, type SubjectOption } from "@/components/ui/subject-select";
import { GenerationScopePicker } from "@/components/ui/generation-scope-picker";
import { Diagram } from "@/components/ui/diagram";
import type { GenerationDifficulty } from "@/lib/generation";
import { useJob } from "@/lib/use-jobs";

interface Exercise {
  id: string;
  subject_id: string;
  prompt: string;
  solution_steps: string[];
  difficulty: string;
  diagram?: string | null;
}
interface TrueFalseItem {
  id: string;
  subject_id: string;
  statement: string;
  is_correct: boolean;
  explanation: string;
}

export function PracticeApp({
  exercises,
  items,
  subjects,
  initialSubjectId = "",
}: {
  exercises: Exercise[];
  items: TrueFalseItem[];
  subjects: SubjectOption[];
  initialSubjectId?: string;
}) {
  const t = useTranslations("Practice");
  const router = useRouter();
  const [tab, setTab] = useState<"exercises" | "truefalse">("exercises");
  const [subjectId, setSubjectId] = useState(initialSubjectId);
  const [topicIds, setTopicIds] = useState<string[]>([]);
  const [columnIds, setColumnIds] = useState<string[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState<GenerationDifficulty>("medium");
  const [count, setCount] = useState(5);
  const [busy, setBusy] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [tfAnswers, setTfAnswers] = useState<Record<string, boolean>>({});
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

  async function generate(kind: "exercises" | "truefalse") {
    if (!subjectId || busy) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectId, count, topicIds, columnIds, keywords, difficulty }),
      });
      const d = (await r.json()) as { job?: { id: string }; error?: string };
      if (!r.ok || !d.job) throw new Error(d.error || "error");
      setJobId(d.job.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
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
      <Card className="flex flex-wrap items-end gap-3 p-4">
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
          className="min-w-52"
        />
        <input
          type="number"
          min={1}
          max={20}
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
          className="w-24 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-ring"
        />
        <Button onClick={() => generate("exercises")} disabled={busy || !subjectId}>
          {busy ? t("generating") : t("generateExercises")}
        </Button>
        <Button
          variant="secondary"
          onClick={() => generate("truefalse")}
          disabled={busy || !subjectId}
        >
          {t("generateTrueFalse")}
        </Button>
        {error && <span className="text-sm text-danger">{error}</span>}
      </Card>

      <GenerationScopePicker
        subjectId={subjectId}
        topicIds={topicIds}
        onTopicIdsChange={setTopicIds}
        columnIds={columnIds}
        onColumnIdsChange={setColumnIds}
        keywords={keywords}
        onKeywordsChange={setKeywords}
        difficulty={difficulty}
        onDifficultyChange={setDifficulty}
      />

      <div className="inline-flex rounded-xl border border-border bg-card p-1 shadow-soft">
        <button
          onClick={() => setTab("exercises")}
          className={
            "min-h-8 rounded-lg px-3 py-1.5 text-sm font-medium transition " +
            (tab === "exercises"
              ? "bg-accent/10 text-accent ring-1 ring-accent/20"
              : "text-muted hover:text-foreground")
          }
        >
          {t("exercises")}
        </button>
        <button
          onClick={() => setTab("truefalse")}
          className={
            "min-h-8 rounded-lg px-3 py-1.5 text-sm font-medium transition " +
            (tab === "truefalse"
              ? "bg-accent/10 text-accent ring-1 ring-accent/20"
              : "text-muted hover:text-foreground")
          }
        >
          {t("trueFalse")}
        </button>
      </div>

      {(() => {
        const visibleExercises = subjectId
          ? exercises.filter((exercise) => exercise.subject_id === subjectId)
          : exercises;
        const visibleItems = subjectId
          ? items.filter((item) => item.subject_id === subjectId)
          : items;

        if (tab === "exercises") {
          return visibleExercises.length === 0 ? (
            <EmptyState
              title={t("emptyExercises")}
              icon={<NavIcon name="exercises" className="h-5 w-5" />}
            />
          ) : (
            <div className="space-y-3">
              {visibleExercises.map((ex) => (
                <Card key={ex.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium">{ex.prompt}</p>
                    <button
                      onClick={() => remove("exercises", ex.id)}
                      className="shrink-0 text-xs text-muted transition hover:text-danger"
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
                  {ex.diagram && (
                    <div className="mt-3">
                      <Diagram svg={ex.diagram} />
                    </div>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-3 px-0"
                    onClick={() => setRevealed((p) => ({ ...p, [ex.id]: !p[ex.id] }))}
                  >
                    {revealed[ex.id] ? t("hideSolution") : t("showSolution")}
                  </Button>
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
                </Card>
              ))}
            </div>
          );
        }

        return visibleItems.length === 0 ? (
          <EmptyState
            title={t("emptyTrueFalse")}
            icon={<NavIcon name="quizzes" className="h-5 w-5" />}
          />
        ) : (
          <div className="space-y-3">
            {visibleItems.map((item) => {
              const answered = item.id in tfAnswers;
              const correct = tfAnswers[item.id] === item.is_correct;
              const btnClass = (value: boolean) => {
                if (!answered) return "border-border hover:border-accent";
                if (value === item.is_correct)
                  return "border-success bg-success/10 text-success";
                if (tfAnswers[item.id] === value) return "border-danger bg-danger/10 text-danger";
                return "border-border opacity-60";
              };
              return (
                <Card key={item.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium">{item.statement}</p>
                    <button
                      onClick={() => remove("truefalse", item.id)}
                      className="shrink-0 text-xs text-muted transition hover:text-danger"
                      title={t("deleteItem")}
                      aria-label={t("deleteItem")}
                    >
                      ✕
                    </button>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => setTfAnswers((p) => ({ ...p, [item.id]: true }))}
                      disabled={answered}
                      className={btnClass(true)}
                    >
                      {t("true")}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => setTfAnswers((p) => ({ ...p, [item.id]: false }))}
                      disabled={answered}
                      className={btnClass(false)}
                    >
                      {t("false")}
                    </Button>
                  </div>
                  {answered && (
                    <div className="mt-3">
                      <p
                        className={
                          "text-sm font-medium " + (correct ? "text-success" : "text-danger")
                        }
                      >
                        {correct ? t("correct") : t("incorrect")}
                      </p>
                      {item.explanation && (
                        <p className="mt-1 text-sm text-muted">
                          <span className="font-medium">{t("explanation")}:</span>{" "}
                          {item.explanation}
                        </p>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        );
      })()}
    </div>
  );
}
