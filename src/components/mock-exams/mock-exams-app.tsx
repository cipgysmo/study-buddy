"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
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

interface Exam {
  id: string;
  subject_id: string;
  title: string;
  duration_min: number;
  created_at: string;
  source_refs: string | null;
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
  const [group, setGroup] = useState<GroupMode>("subject");
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [visibleCounts, setVisibleCounts] = useState<Record<string, number>>({});
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

  function start(exam: Exam) {
    router.push(`/quizzes/${exam.id}`);
  }

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-10 flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card/90 p-4 backdrop-blur">
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
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={tc("searchPlaceholder")}
          aria-label={tc("search")}
          className="min-w-52 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
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
        const q = query.trim().toLowerCase();
        const filtered = exams.filter(
          (exam) =>
            (!subjectId || exam.subject_id === subjectId) &&
            (!q || exam.title.toLowerCase().includes(q))
        );
        const visible = sortItems(filtered, sort, (exam) => exam.title, locale);
        if (visible.length === 0) {
          return (
            <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-muted">
              {t("empty")}
            </div>
          );
        }

        const groups =
          group === "subject"
            ? groupItemsBySubjectAndDay(visible, subjects, locale, sort === "oldest" ? "asc" : "desc")
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
                      items: visible,
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
                        {shown.map((exam) => (
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
                            <SourceChips value={exam.source_refs} subjectId={exam.subject_id} />
                          </li>
                        ))}
                      </ul>
                      {!isCollapsed && day.items.length > limit && (
                        <button
                          onClick={() => setVisibleCounts((prev) => ({ ...prev, [key]: limit + PAGE_SIZE }))}
                          className="min-h-10 rounded-lg px-2 text-xs font-medium text-accent transition hover:bg-accent/10"
                        >
                          {tc("showMore")}
                        </button>
                      )}
                      {!isCollapsed && limit > PAGE_SIZE && (
                        <button
                          onClick={() => setVisibleCounts((prev) => ({ ...prev, [key]: PAGE_SIZE }))}
                          className="min-h-10 rounded-lg px-2 text-xs font-medium text-accent transition hover:bg-accent/10"
                        >
                          {tc("showLess")}
                        </button>
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
