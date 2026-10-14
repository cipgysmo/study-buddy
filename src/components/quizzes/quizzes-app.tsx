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
import { SourceChips } from "@/components/ui/source-chips";
import type { GenerationDifficulty } from "@/lib/generation";
import {
  groupItemsBySubjectAndDay,
  sortItems,
  type GroupMode,
  type SortMode,
} from "@/lib/list-view";
import { useJob } from "@/lib/use-jobs";

const PAGE_SIZE = 10;

interface Quiz {
  id: string;
  subject_id: string;
  title: string;
  created_at: string;
  source_refs: string | null;
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
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [visibleCounts, setVisibleCounts] = useState<Record<string, number>>({});
  const [topicIds, setTopicIds] = useState<string[]>([]);
  const [columnIds, setColumnIds] = useState<string[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [customPrompt, setCustomPrompt] = useState("");
  const [difficulty, setDifficulty] = useState<GenerationDifficulty>("balanced");
  const [count, setCount] = useState(5);
  const [busy, setBusy] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState("");
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

  function loadQuiz(id: string) {
    router.push(`/quizzes/${id}`);
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

  return (
    <div className="space-y-6">
      <Card className="sticky top-0 z-10 flex flex-wrap items-end gap-3 p-4 backdrop-blur">
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
          group === "subject"
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
                {section.dayGroups.map((day) => {
                  const key = `${section.subjectId ?? "all"}|${day.dayKey}`;
                  const isCollapsed = collapsed.has(key);
                  const limit = visibleCounts[key] ?? PAGE_SIZE;
                  const shown = isCollapsed ? [] : day.items.slice(0, limit);
                  return (
                    <div key={key} className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setCollapsed((prev) => {
                              const next = new Set(prev);
                              if (next.has(key)) next.delete(key);
                              else next.add(key);
                              return next;
                            })
                          }
                          className="min-h-10 rounded-lg px-2 text-left text-xs font-medium text-muted transition hover:bg-foreground/5 hover:text-foreground"
                          aria-expanded={!isCollapsed}
                        >
                          {isCollapsed ? tc("expand") : tc("collapse")}
                        </button>
                        <p className="text-xs font-medium text-muted">
                          {day.dayLabel}
                          {day.timeLabel ? ` · ${day.timeLabel}` : ""}
                          <span className="ml-2 opacity-70">({day.items.length})</span>
                        </p>
                      </div>
                      <ul className="grid gap-3 sm:grid-cols-2">
                        {shown.map((q) => (
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
                              <SourceChips value={q.source_refs} subjectId={q.subject_id} />
                            </Card>
                          </li>
                        ))}
                      </ul>
                      {!isCollapsed && day.items.length > limit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setVisibleCounts((prev) => ({ ...prev, [key]: limit + PAGE_SIZE }))}
                        >
                          {tc("showMore")}
                        </Button>
                      )}
                      {!isCollapsed && limit > PAGE_SIZE && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setVisibleCounts((prev) => ({ ...prev, [key]: PAGE_SIZE }))}
                        >
                          {tc("showLess")}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </section>
            ))}
          </div>
        );
      })()}
    </div>
  );
}
