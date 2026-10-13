"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { NavIcon } from "@/components/shell/nav-icons";
import { SourceChips } from "@/components/ui/source-chips";
import { SubjectSelect, type SubjectOption } from "@/components/ui/subject-select";
import { GenerationScopePicker } from "@/components/ui/generation-scope-picker";
import { Diagram } from "@/components/ui/diagram";
import type { GenerationDifficulty } from "@/lib/generation";
import {
  findDuplicateIds,
  groupItemsBySubjectAndDay,
  sortItems,
  type GroupMode,
  type SortMode,
  type SubjectDayGroup,
} from "@/lib/list-view";
import { loadSavedFilters, saveSavedFilters } from "@/lib/saved-filters";
import { useJob } from "@/lib/use-jobs";

interface ListItem {
  id: string;
  subject_id: string;
  created_at: string;
  source_refs: string | null;
}

interface Exercise extends ListItem {
  prompt: string;
  solution_steps: string[];
  difficulty: string;
  diagram?: string | null;
}
interface TrueFalseItem extends ListItem {
  statement: string;
  is_correct: boolean;
  explanation: string;
}
interface TypedExercise extends ListItem {
  prompt: string;
  expected_answer: string;
  accepted_answers: string[];
  grading_mode: "exact" | "flexible" | "creative";
  explanation: string;
  difficulty: string;
}
interface GradeResult {
  correct: boolean;
  score: number;
  feedback: string;
}

interface SavedFilters {
  subjectId: string;
  sort: SortMode;
  group: GroupMode;
  query: string;
  difficultyFilter: string;
  gradingModeFilter: string;
  dateFrom: string;
  dateTo: string;
  duplicatesOnly: boolean;
}

const PAGE_SIZE = 10;
const FILTER_KEY = "study-buddy:practice-filters:v2";

export function PracticeApp({
  exercises,
  items,
  typedExercises,
  subjects,
  initialSubjectId = "",
}: {
  exercises: Exercise[];
  items: TrueFalseItem[];
  typedExercises: TypedExercise[];
  subjects: SubjectOption[];
  initialSubjectId?: string;
}) {
  const t = useTranslations("Practice");
  const tc = useTranslations("Common");
  const ts = useTranslations("Subjects");
  const locale = useLocale();
  const router = useRouter();
  const [tab, setTab] = useState<"exercises" | "truefalse" | "typed">("exercises");
  const [subjectId, setSubjectId] = useState(initialSubjectId);
  const [sort, setSort] = useState<SortMode>("newest");
  const [group, setGroup] = useState<GroupMode>("subject");
  const [query, setQuery] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState("");
  const [gradingModeFilter, setGradingModeFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [duplicatesOnly, setDuplicatesOnly] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
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
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [tfAnswers, setTfAnswers] = useState<Record<string, boolean>>({});
  const [typedAnswers, setTypedAnswers] = useState<Record<string, string>>({});
  const [typedResults, setTypedResults] = useState<Record<string, GradeResult>>({});
  const [gradingId, setGradingId] = useState<string | null>(null);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    const saved = loadSavedFilters<SavedFilters>(FILTER_KEY, {
      subjectId: initialSubjectId,
      sort: "newest",
      group: "subject",
      query: "",
      difficultyFilter: "",
      gradingModeFilter: "",
      dateFrom: "",
      dateTo: "",
      duplicatesOnly: false,
    });
    setSubjectId(saved.subjectId || initialSubjectId);
    setSort(saved.sort);
    setGroup(saved.group);
    setQuery(saved.query);
    setDifficultyFilter(saved.difficultyFilter);
    setGradingModeFilter(saved.gradingModeFilter);
    setDateFrom(saved.dateFrom);
    setDateTo(saved.dateTo);
    setDuplicatesOnly(saved.duplicatesOnly);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [initialSubjectId]);

  useEffect(() => {
    saveSavedFilters<SavedFilters>(FILTER_KEY, {
      subjectId,
      sort,
      group,
      query,
      difficultyFilter,
      gradingModeFilter,
      dateFrom,
      dateTo,
      duplicatesOnly,
    });
  }, [subjectId, sort, group, query, difficultyFilter, gradingModeFilter, dateFrom, dateTo, duplicatesOnly]);

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

  async function generate(kind: "exercises" | "truefalse" | "typedexercises") {
    if (!subjectId || busy) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/${kind}`, {
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

  async function answerTrueFalse(id: string, answer: boolean) {
    setTfAnswers((p) => ({ ...p, [id]: answer }));
    await fetch(`/api/truefalse/${id}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer }),
    });
  }

  async function remove(kind: "exercises" | "truefalse" | "typedexercises", id: string) {
    await fetch(`/api/${kind}/${id}`, { method: "DELETE" });
    router.refresh();
  }

  async function bulk(action: "archive" | "delete") {
    if (selected.size === 0) return;
    const type = tab === "typed" ? "typedexercises" : tab;
    await fetch("/api/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, action, ids: [...selected] }),
    });
    setSelected(new Set());
    router.refresh();
  }

  async function gradeTyped(id: string) {
    if (gradingId) return;
    setGradingId(id);
    setError("");
    try {
      const r = await fetch(`/api/typedexercises/${id}/grade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer: typedAnswers[id] ?? "" }),
      });
      const d = (await r.json()) as GradeResult & { error?: string };
      if (!r.ok || d.error) throw new Error(d.error || "error");
      setTypedResults((prev) => ({ ...prev, [id]: d }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGradingId(null);
    }
  }

  function gradingModeLabel(mode: TypedExercise["grading_mode"]) {
    if (mode === "exact") return t("modeExact");
    if (mode === "creative") return t("modeCreative");
    return t("modeFlexible");
  }

  function difficultyLabel(d: string) {
    if (d === "balanced") return ts("difficultyBalanced");
    if (d === "easy") return ts("difficultyNoob");
    if (d === "hard") return ts("difficultyPro");
    if (d === "expert") return ts("difficultyHacker");
    return ts("difficultyPedestrian");
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleGroup(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function visibleGroups<T extends ListItem>(
    all: T[],
    nameOf: (item: T) => string,
    extraFilter?: (item: T) => boolean
  ): SubjectDayGroup<T>[] {
    const q = query.trim().toLowerCase();
    const duplicates = duplicatesOnly ? findDuplicateIds(all, nameOf) : null;
    const filtered = all.filter((item) => {
      const day = item.created_at.slice(0, 10);
      return (
        (!subjectId || item.subject_id === subjectId) &&
        (!q || nameOf(item).toLowerCase().includes(q)) &&
        (!dateFrom || day >= dateFrom) &&
        (!dateTo || day <= dateTo) &&
        (!duplicates || duplicates.has(item.id)) &&
        (!extraFilter || extraFilter(item))
      );
    });
    const sorted = sortItems(filtered, sort, nameOf, locale);
    if (group === "subject") {
      return groupItemsBySubjectAndDay(sorted, subjects, locale, sort === "oldest" ? "asc" : "desc");
    }
    return [
      {
        subjectId: null,
        subjectName: "",
        color: null,
        dayGroups: [{ dayKey: "all", dayLabel: "", timeLabel: null, items: sorted }],
      },
    ];
  }

  const typedGroups = visibleGroups(
    typedExercises,
    (item) => item.prompt,
    (item) =>
      (!difficultyFilter || item.difficulty === difficultyFilter) &&
      (!gradingModeFilter || item.grading_mode === gradingModeFilter)
  );
  const exerciseGroups = visibleGroups(
    exercises,
    (item) => item.prompt,
    (item) => !difficultyFilter || item.difficulty === difficultyFilter
  );
  const itemGroups = visibleGroups(items, (item) => item.statement);

  function renderGrouped<T extends ListItem>(
    groups: SubjectDayGroup<T>[],
    emptyTitle: string,
    icon: "exercises" | "quizzes",
    renderItem: (item: T, index: number) => ReactNode
  ) {
    if (groups.every((section) => section.dayGroups.every((day) => day.items.length === 0))) {
      return <EmptyState title={emptyTitle} icon={<NavIcon name={icon} className="h-5 w-5" />} />;
    }

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
                      onClick={() => toggleGroup(key)}
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
                  <div className="space-y-3">
                    {shown.map((item, index) => renderItem(item, index))}
                  </div>
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
  }

  function checkbox(id: string) {
    return (
      <input
        type="checkbox"
        checked={selected.has(id)}
        onChange={() => toggleSelected(id)}
        aria-label={tc("selectAll")}
        className="mt-1 h-4 w-4 accent-[var(--color-accent)]"
      />
    );
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
          max={20}
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
          className="w-24 min-h-10 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-ring"
        />
        <Button onClick={() => generate("exercises")} disabled={busy || !subjectId}>
          {busy ? t("generating") : t("generateExercises")}
        </Button>
        <Button variant="secondary" onClick={() => generate("truefalse")} disabled={busy || !subjectId}>
          {t("generateTrueFalse")}
        </Button>
        <Button variant="secondary" onClick={() => generate("typedexercises")} disabled={busy || !subjectId}>
          {t("generateTyped")}
        </Button>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={tc("searchPlaceholder")}
          aria-label={tc("search")}
          className="min-h-10 min-w-52 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-ring"
        />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <label className="text-xs text-muted">
            {tc("sortLabel")}
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortMode)}
              className="ml-2 min-h-10 rounded-xl border border-border bg-background px-2 py-1 text-sm outline-none focus:border-accent"
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
              className="ml-2 min-h-10 rounded-xl border border-border bg-background px-2 py-1 text-sm outline-none focus:border-accent"
            >
              <option value="none">{tc("groupNone")}</option>
              <option value="subject">{tc("groupSubject")}</option>
            </select>
          </label>
          <label className="text-xs text-muted">
            {tc("difficultyFilter")}
            <select
              value={difficultyFilter}
              onChange={(e) => setDifficultyFilter(e.target.value)}
              className="ml-2 min-h-10 rounded-xl border border-border bg-background px-2 py-1 text-sm outline-none focus:border-accent"
            >
              <option value="">—</option>
              <option value="balanced">{ts("difficultyBalanced")}</option>
              <option value="easy">{ts("difficultyNoob")}</option>
              <option value="medium">{ts("difficultyPedestrian")}</option>
              <option value="hard">{ts("difficultyPro")}</option>
              <option value="expert">{ts("difficultyHacker")}</option>
            </select>
          </label>
          {tab === "typed" && (
            <label className="text-xs text-muted">
              {tc("gradingModeFilter")}
              <select
                value={gradingModeFilter}
                onChange={(e) => setGradingModeFilter(e.target.value)}
                className="ml-2 min-h-10 rounded-xl border border-border bg-background px-2 py-1 text-sm outline-none focus:border-accent"
              >
                <option value="">—</option>
                <option value="exact">{t("modeExact")}</option>
                <option value="flexible">{t("modeFlexible")}</option>
                <option value="creative">{t("modeCreative")}</option>
              </select>
            </label>
          )}
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            aria-label={tc("dateFrom")}
            className="min-h-10 rounded-xl border border-border bg-background px-2 py-1 text-sm"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            aria-label={tc("dateTo")}
            className="min-h-10 rounded-xl border border-border bg-background px-2 py-1 text-sm"
          />
          <label className="flex min-h-10 items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={duplicatesOnly}
              onChange={(e) => setDuplicatesOnly(e.target.checked)}
              className="h-4 w-4 accent-[var(--color-accent)]"
            />
            {tc("duplicates")}
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

      <div className="inline-flex rounded-xl border border-border bg-card p-1 shadow-soft">
        <button
          onClick={() => setTab("exercises")}
          className={
            "min-h-10 rounded-lg px-3 py-1.5 text-sm font-medium transition " +
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
            "min-h-10 rounded-lg px-3 py-1.5 text-sm font-medium transition " +
            (tab === "truefalse"
              ? "bg-accent/10 text-accent ring-1 ring-accent/20"
              : "text-muted hover:text-foreground")
          }
        >
          {t("trueFalse")}
        </button>
        <button
          onClick={() => setTab("typed")}
          className={
            "min-h-10 rounded-lg px-3 py-1.5 text-sm font-medium transition " +
            (tab === "typed"
              ? "bg-accent/10 text-accent ring-1 ring-accent/20"
              : "text-muted hover:text-foreground")
          }
        >
          {t("typed")}
        </button>
      </div>

      {selected.size > 0 && (
        <div className="sticky top-14 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 shadow-soft">
          <span className="text-sm text-muted">{tc("selectedCount", { count: selected.size })}</span>
          <Button size="sm" variant="secondary" onClick={() => void bulk("archive")}>
            {tc("archive")}
          </Button>
          <Button size="sm" variant="danger" onClick={() => void bulk("delete")}>
            {tc("deleteSelected")}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            {tc("cancel")}
          </Button>
        </div>
      )}

      {tab === "typed" &&
        renderGrouped(typedGroups, t("emptyTyped"), "exercises", (ex, index) => {
          const result = typedResults[ex.id];
          return (
            <Card key={ex.id} className="p-4">
              <div className="flex items-start gap-2">
                {checkbox(ex.id)}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium">
                      <span className="mr-2 text-muted">{index + 1}.</span>
                      {ex.prompt}
                    </p>
                    <button
                      onClick={() => remove("typedexercises", ex.id)}
                      className="shrink-0 text-xs text-muted transition hover:text-danger"
                      title={t("deleteTyped")}
                      aria-label={t("deleteTyped")}
                    >
                      ✕
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent">
                      {difficultyLabel(ex.difficulty)}
                    </span>
                    <span className="rounded-full bg-foreground/5 px-2 py-0.5 text-xs text-muted">
                      {gradingModeLabel(ex.grading_mode)}
                    </span>
                  </div>
                  {result && <SourceChips value={ex.source_refs} subjectId={ex.subject_id} />}
                  <div className="mt-3 space-y-2">
                    <label className="block text-xs font-semibold text-muted" htmlFor={`typed-${ex.id}`}>
                      {t("yourAnswer")}
                    </label>
                    <textarea
                      id={`typed-${ex.id}`}
                      value={typedAnswers[ex.id] ?? ""}
                      onChange={(e) => setTypedAnswers((prev) => ({ ...prev, [ex.id]: e.target.value }))}
                      placeholder={t("typedAnswerPlaceholder")}
                      rows={3}
                      className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-ring"
                    />
                    <Button
                      size="sm"
                      onClick={() => void gradeTyped(ex.id)}
                      disabled={gradingId === ex.id || !typedAnswers[ex.id]?.trim()}
                    >
                      {gradingId === ex.id ? t("checking") : t("checkAnswer")}
                    </Button>
                  </div>
                  {result && (
                    <div className="mt-3 rounded-xl bg-background p-3">
                      <p
                        className={
                          "text-sm font-medium " + (result.correct ? "text-success" : "text-danger")
                        }
                      >
                        {result.correct ? t("correct") : t("incorrect")}
                      </p>
                      <p className="mt-1 text-sm text-muted">{t("score", { score: result.score })}</p>
                      {result.feedback && (
                        <p className="mt-1 text-sm">
                          <span className="font-medium">{t("explanation")}:</span> {result.feedback}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          );
        })}

      {tab === "exercises" &&
        renderGrouped(exerciseGroups, t("emptyExercises"), "exercises", (ex, index) => (
          <Card key={ex.id} className="p-4">
            <div className="flex items-start gap-2">
              {checkbox(ex.id)}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium">
                    <span className="mr-2 text-muted">{index + 1}.</span>
                    {ex.prompt}
                  </p>
                  <button
                    onClick={() => remove("exercises", ex.id)}
                    className="shrink-0 text-xs text-muted transition hover:text-danger"
                    title={t("deleteExercise")}
                    aria-label={t("deleteExercise")}
                  >
                    ✕
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent">
                    {difficultyLabel(ex.difficulty)}
                  </span>
                </div>
                {revealed[ex.id] && <SourceChips value={ex.source_refs} subjectId={ex.subject_id} />}
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
              </div>
            </div>
          </Card>
        ))}

      {tab === "truefalse" &&
        renderGrouped(itemGroups, t("emptyTrueFalse"), "quizzes", (item, index) => {
          const answered = item.id in tfAnswers;
          const correct = tfAnswers[item.id] === item.is_correct;
          const btnClass = (value: boolean) => {
            if (!answered) return "border-border hover:border-accent";
            if (value === item.is_correct) return "border-success bg-success/10 text-success";
            if (tfAnswers[item.id] === value) return "border-danger bg-danger/10 text-danger";
            return "border-border opacity-60";
          };
          return (
            <Card key={item.id} className="p-4">
              <div className="flex items-start gap-2">
                {checkbox(item.id)}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium">
                      <span className="mr-2 text-muted">{index + 1}.</span>
                      {item.statement}
                    </p>
                    <button
                      onClick={() => remove("truefalse", item.id)}
                      className="shrink-0 text-xs text-muted transition hover:text-danger"
                      title={t("deleteItem")}
                      aria-label={t("deleteItem")}
                    >
                      ✕
                    </button>
                  </div>
                  {answered && <SourceChips value={item.source_refs} subjectId={item.subject_id} />}
                  <div className="mt-3 flex gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => void answerTrueFalse(item.id, true)}
                      disabled={answered}
                      className={btnClass(true)}
                    >
                      {t("true")}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => void answerTrueFalse(item.id, false)}
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
                          <span className="font-medium">{t("explanation")}:</span> {item.explanation}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
    </div>
  );
}
