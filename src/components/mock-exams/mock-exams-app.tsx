"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { SubjectSelect, type SubjectOption } from "@/components/ui/subject-select";
import { GenerationScopePicker } from "@/components/ui/generation-scope-picker";
import { DeleteButton } from "@/components/subjects/delete-button";
import type { GenerationDifficulty } from "@/lib/generation";
import { formatDate } from "@/lib/format";
import { groupItemsBySubject, sortItems, type GroupMode, type SortMode } from "@/lib/list-view";
import { useJob } from "@/lib/use-jobs";
import { QuizRunner, type RunnerQuestion } from "@/components/quizzes/quiz-runner";

interface Exam {
  id: string;
  subject_id: string;
  title: string;
  duration_min: number;
  created_at: string;
}

export function MockExamsApp({
  exams,
  subjects,
}: {
  exams: Exam[];
  subjects: SubjectOption[];
}) {
  const t = useTranslations("MockExams");
  const tc = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();
  const [subjectId, setSubjectId] = useState("");
  const [sort, setSort] = useState<SortMode>("newest");
  const [group, setGroup] = useState<GroupMode>("none");
  const [topicIds, setTopicIds] = useState<string[]>([]);
  const [columnIds, setColumnIds] = useState<string[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [customPrompt, setCustomPrompt] = useState("");
  const [difficulty, setDifficulty] = useState<GenerationDifficulty>("balanced");
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
          difficulty,
          customPrompt,
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
            setCustomPrompt("");
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
        <div className="ml-auto flex items-center gap-2">
          <label className="text-xs text-muted">
            {tc("sortLabel")}
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortMode)}
              className="ml-2 min-h-9 rounded-lg border border-border bg-background px-2 py-1 text-sm"
            >
              <option value="newest">{tc("sortNewest")}</option>
              <option value="oldest">{tc("sortOldest")}</option>
              <option value="name">{tc("sortName")}</option>
            </select>
          </label>
          <label className="text-xs text-muted">
            {tc("groupLabel")}
            <select
              value={group}
              onChange={(e) => setGroup(e.target.value as GroupMode)}
              className="ml-2 min-h-9 rounded-lg border border-border bg-background px-2 py-1 text-sm"
            >
              <option value="none">{tc("groupNone")}</option>
              <option value="subject">{tc("groupSubject")}</option>
            </select>
          </label>
        </div>
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
        difficulty={difficulty}
        onDifficultyChange={setDifficulty}
        customPrompt={customPrompt}
        onCustomPromptChange={setCustomPrompt}
      />

      {(() => {
        const filtered = subjectId ? exams.filter((exam) => exam.subject_id === subjectId) : exams;
        const visible = sortItems(filtered, sort, (exam) => exam.title, locale);
        if (visible.length === 0) {
          return (
            <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-muted">
              {t("empty")}
            </div>
          );
        }

        const groups =
          group === "subject" && !subjectId
            ? groupItemsBySubject(visible, subjects)
            : [{ subjectId: null, subjectName: "", color: null, items: visible }];

        return (
          <div className="space-y-5">
            {groups.map((section) => (
              <section key={section.subjectId ?? "all"} className="space-y-2">
                {section.subjectName && (
                  <div className="flex items-center gap-2">
                    {section.color && (
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: section.color }} />
                    )}
                    <h2 className="text-sm font-semibold">{section.subjectName}</h2>
                  </div>
                )}
                <ul className="grid gap-3 sm:grid-cols-2">
                  {section.items.map((exam) => (
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
                      <p className="mt-1 text-xs text-muted">
                        {tc("createdOn", { date: formatDate(exam.created_at, locale) })}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        );
      })()}
    </div>
  );
}
