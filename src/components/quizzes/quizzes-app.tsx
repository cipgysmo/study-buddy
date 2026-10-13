"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { NavIcon } from "@/components/shell/nav-icons";
import { SubjectSelect, type SubjectOption } from "@/components/ui/subject-select";
import { GenerationScopePicker } from "@/components/ui/generation-scope-picker";
import { DeleteButton } from "@/components/subjects/delete-button";
import type { GenerationDifficulty } from "@/lib/generation";
import {
  groupItemsBySubjectAndDay,
  sortItems,
  type GroupMode,
  type SortMode,
} from "@/lib/list-view";
import { useJob } from "@/lib/use-jobs";
import { QuizRunner, type RunnerQuestion } from "./quiz-runner";

interface Quiz {
  id: string;
  subject_id: string;
  title: string;
  created_at: string;
}

export function QuizzesApp({
  quizzes,
  subjects,
  initialSubjectId = "",
}: {
  quizzes: Quiz[];
  subjects: SubjectOption[];
  initialSubjectId?: string;
}) {
  const t = useTranslations("Quizzes");
  const tc = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();
  const [subjectId, setSubjectId] = useState(initialSubjectId);
  const [sort, setSort] = useState<SortMode>("newest");
  const [group, setGroup] = useState<GroupMode>("subject");
  const [query, setQuery] = useState("");
  const [topicIds, setTopicIds] = useState<string[]>([]);
  const [columnIds, setColumnIds] = useState<string[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [customPrompt, setCustomPrompt] = useState("");
  const [difficulty, setDifficulty] = useState<GenerationDifficulty>("balanced");
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
        body: JSON.stringify({
          subjectId,
          count,
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
      <Card className="flex flex-wrap items-end gap-3 p-4">
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
          className="min-w-52"
        />
        <input
          type="number"
          min={1}
          max={30}
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
          className="w-24 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-ring"
        />
        <Button onClick={generate} disabled={busy || !subjectId}>
          {busy ? t("generating") : t("generate")}
        </Button>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={tc("searchPlaceholder")}
          aria-label={tc("search")}
          className="min-w-52 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-ring"
        />
        <div className="ml-auto flex items-center gap-2">
          <label className="text-xs text-muted">
            {tc("sortLabel")}
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortMode)}
              className="ml-2 min-h-9 rounded-xl border border-border bg-background px-2 py-1 text-sm outline-none focus:border-accent"
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
              className="ml-2 min-h-9 rounded-xl border border-border bg-background px-2 py-1 text-sm outline-none focus:border-accent"
            >
              <option value="none">{tc("groupNone")}</option>
              <option value="subject">{tc("groupSubject")}</option>
            </select>
          </label>
        </div>
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
        customPrompt={customPrompt}
        onCustomPromptChange={setCustomPrompt}
      />

      {(() => {
        const q = query.trim().toLowerCase();
        const filtered = quizzes.filter(
          (quiz) =>
            (!subjectId || quiz.subject_id === subjectId) &&
            (!q || quiz.title.toLowerCase().includes(q))
        );
        const visibleQuizzes = sortItems(filtered, sort, (quiz) => quiz.title, locale);
        if (visibleQuizzes.length === 0) {
          return <EmptyState title={t("empty")} icon={<NavIcon name="quizzes" className="h-5 w-5" />} />;
        }

        const groups =
          group === "subject" && !subjectId
            ? groupItemsBySubjectAndDay(visibleQuizzes, subjects, locale, sort === "oldest" ? "asc" : "desc")
            : [
                {
                  subjectId: null,
                  subjectName: "",
                  color: null,
                  dayGroups: [
                    {
                      dayKey: "all",
                      dayLabel: "",
                      timeLabel: null,
                      items: visibleQuizzes,
                    },
                  ],
                },
              ];

        return (
          <div className="space-y-5">
            {groups.map((section) => (
              <section key={section.subjectId ?? "all"} className="space-y-3">
                {section.subjectName && (
                  <div className="flex items-center gap-2">
                    {section.color && (
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: section.color }} />
                    )}
                    <h2 className="text-sm font-semibold">{section.subjectName}</h2>
                  </div>
                )}
                {section.dayGroups.map((day) => (
                  <div key={day.dayKey} className="space-y-2">
                    {(day.dayLabel || day.timeLabel) && (
                      <p className="text-xs font-medium text-muted">
                        {day.dayLabel}
                        {day.timeLabel ? ` · ${day.timeLabel}` : ""}
                      </p>
                    )}
                    <ul className="grid gap-3 sm:grid-cols-2">
                      {day.items.map((q) => (
                        <li key={q.id}>
                          <Card className="p-4">
                            <div className="flex items-center justify-between gap-3">
                              <button
                                onClick={() => loadQuiz(q.id)}
                                className="min-w-0 truncate text-left font-medium transition hover:text-accent"
                              >
                                {q.title}
                              </button>
                              <DeleteButton href={`/api/quizzes/${q.id}`} label={t("deleteQuiz")} />
                            </div>
                          </Card>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </section>
            ))}
          </div>
        );
      })()}
    </div>
  );
}
