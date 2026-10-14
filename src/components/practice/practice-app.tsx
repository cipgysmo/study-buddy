"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { NavIcon } from "@/components/shell/nav-icons";
import { MaterialPreviewModal } from "@/components/ui/material-preview-modal";
import { SourceChips } from "@/components/ui/source-chips";
import { SubjectSelect, type SubjectOption } from "@/components/ui/subject-select";
import { Diagram } from "@/components/ui/diagram";
import { PracticeGenerateModal } from "@/components/practice/practice-generate-modal";
import { isPracticeTab, type PracticeTab } from "@/lib/practice-types";
import {
  findDuplicateIds,
  groupItemsBySet,
  groupItemsBySubjectAndDay,
  sortItems,
  type GroupMode,
  type SetGroup,
  type SortMode,
  type SourceRef,
  type SubjectDayGroup,
} from "@/lib/list-view";
import { loadSavedFilters, saveSavedFilters } from "@/lib/saved-filters";
import { useJob } from "@/lib/use-jobs";

interface ListItem {
  id: string;
  subject_id: string;
  created_at: string;
  source_refs: string | null;
  set_id: string | null;
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

interface PracticeView {
  id: string;
  name: string;
  tab: PracticeTab;
  filters: SavedFilters;
}

const PAGE_SIZE = 10;
const FILTER_KEY = "study-buddy:practice-filters:v4";
const SESSION_KEY = "study-buddy:practice-session:v1";
const VIEWS_KEY = "study-buddy:practice-views:v1";
const TABS: PracticeTab[] = ["exercises", "truefalse", "typed"];

interface PracticeSession {
  revealed: Record<string, boolean>;
  tfAnswers: Record<string, boolean>;
  typedAnswers: Record<string, string>;
  typedResults: Record<string, GradeResult>;
}

function loadPracticeSession(): PracticeSession {
  if (typeof window === "undefined") {
    return { revealed: {}, tfAnswers: {}, typedAnswers: {}, typedResults: {} };
  }
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return { revealed: {}, tfAnswers: {}, typedAnswers: {}, typedResults: {} };
    const parsed = JSON.parse(raw) as Partial<PracticeSession>;
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

function savePracticeSession(session: PracticeSession): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    window.dispatchEvent(new Event("study-buddy:practice-session-updated"));
  } catch {
    /* ignore */
  }
}

function loadViews(): PracticeView[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(VIEWS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as PracticeView[]) : [];
  } catch {
    return [];
  }
}

function saveViews(views: PracticeView[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(VIEWS_KEY, JSON.stringify(views));
  } catch {
    /* ignore */
  }
}

export function PracticeApp({
  exercises,
  items,
  typedExercises,
  subjects,
  initialSubjectId = "",
  initialTab = "exercises",
  initialSetId = "",
  tabParamName = "tab",
  sessionMode = false,
}: {
  exercises: Exercise[];
  items: TrueFalseItem[];
  typedExercises: TypedExercise[];
  subjects: SubjectOption[];
  initialSubjectId?: string;
  initialTab?: PracticeTab;
  initialSetId?: string;
  tabParamName?: string;
  sessionMode?: boolean;
}) {
  const t = useTranslations("Practice");
  const tc = useTranslations("Common");
  const ts = useTranslations("Subjects");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlTab = searchParams?.get(tabParamName) ?? null;
  const urlSet = searchParams?.get("set") ?? null;
  const [tab, setTab] = useState<PracticeTab>(isPracticeTab(urlTab) ? urlTab : initialTab);
  const [setIdFilter, setSetIdFilter] = useState(urlSet ?? initialSetId);
  const [subjectId, setSubjectId] = useState(initialSubjectId);
  const [sort, setSort] = useState<SortMode>("newest");
  const [group, setGroup] = useState<GroupMode>(sessionMode ? "none" : "set");
  const [query, setQuery] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState("");
  const [gradingModeFilter, setGradingModeFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [duplicatesOnly, setDuplicatesOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [views, setViews] = useState<PracticeView[]>([]);
  const [viewName, setViewName] = useState("");
  const [selectedViewId, setSelectedViewId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [visibleCounts, setVisibleCounts] = useState<Record<string, number>>({});
  const [generateOpen, setGenerateOpen] = useState(false);
  const [generateKinds, setGenerateKinds] = useState<PracticeTab[]>(["exercises"]);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [tfAnswers, setTfAnswers] = useState<Record<string, boolean>>({});
  const [typedAnswers, setTypedAnswers] = useState<Record<string, string>>({});
  const [typedResults, setTypedResults] = useState<Record<string, GradeResult>>({});
  const [gradingId, setGradingId] = useState<string | null>(null);
  const [openMaterial, setOpenMaterial] = useState<{ id: string; page?: number } | null>(null);
  const busy = jobId !== null;

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    const session = loadPracticeSession();
    setRevealed(session.revealed);
    setTfAnswers(session.tfAnswers);
    setTypedAnswers(session.typedAnswers);
    setTypedResults(session.typedResults);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    savePracticeSession({ revealed, tfAnswers, typedAnswers, typedResults });
  }, [revealed, tfAnswers, typedAnswers, typedResults]);

  useEffect(() => {
    if (sessionMode) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    const saved = loadSavedFilters<SavedFilters>(FILTER_KEY, {
      subjectId: initialSubjectId,
      sort: "newest",
      group: "set",
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
    setViews(loadViews());
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [initialSubjectId, sessionMode]);

  useEffect(() => {
    if (sessionMode) return;
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
  }, [subjectId, sort, group, query, difficultyFilter, gradingModeFilter, dateFrom, dateTo, duplicatesOnly, sessionMode]);

  useEffect(() => {
    if (sessionMode) return;
    saveViews(views);
  }, [sessionMode, views]);

  useJob(jobId, (settled) => {
    if (settled.status === "done") {
      setJobId(null);
      router.refresh();
    } else {
      setJobId(null);
      setError(settled.error ?? "error");
    }
  });

  function updateQuery(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    for (const [key, value] of Object.entries(updates)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function changeSubject(next: string) {
    setSubjectId(next);
    updateQuery({ subject: next || null });
  }

  function changeTab(next: PracticeTab) {
    if (next === tab) return;
    setTab(next);
    setSelected(new Set());
    if (sessionMode) {
      updateQuery({ [tabParamName]: next });
      return;
    }
    setSetIdFilter("");
    updateQuery({ [tabParamName]: next, set: null });
  }

  function changeSetFilter(next: string) {
    setSetIdFilter(next);
    updateQuery({ set: next || null });
  }

  function clearFilters() {
    setDifficultyFilter("");
    setGradingModeFilter("");
    setDateFrom("");
    setDateTo("");
    setDuplicatesOnly(false);
    setSetIdFilter("");
    updateQuery({ set: null });
  }

  function openGenerate(kinds: PracticeTab[] = [tab]) {
    setGenerateKinds(kinds);
    setGenerateOpen(true);
  }

  function saveView() {
    const name = viewName.trim();
    if (!name) return;
    const view: PracticeView = {
      id: Math.random().toString(36).slice(2),
      name,
      tab,
      filters: {
        subjectId,
        sort,
        group,
        query,
        difficultyFilter,
        gradingModeFilter,
        dateFrom,
        dateTo,
        duplicatesOnly,
      },
    };
    setViews((prev) => [...prev, view]);
    setSelectedViewId(view.id);
    setViewName("");
  }

  function applyView() {
    const view = views.find((x) => x.id === selectedViewId);
    if (!view) return;
    setTab(view.tab);
    setSubjectId(view.filters.subjectId);
    setSort(view.filters.sort);
    setGroup(view.filters.group);
    setQuery(view.filters.query);
    setDifficultyFilter(view.filters.difficultyFilter);
    setGradingModeFilter(view.filters.gradingModeFilter);
    setDateFrom(view.filters.dateFrom);
    setDateTo(view.filters.dateTo);
    setDuplicatesOnly(view.filters.duplicatesOnly);
    setSetIdFilter("");
    updateQuery({
      [tabParamName]: view.tab,
      subject: view.filters.subjectId || null,
      set: null,
    });
  }

  function deleteView() {
    if (!selectedViewId) return;
    setViews((prev) => prev.filter((x) => x.id !== selectedViewId));
    setSelectedViewId("");
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

  function openSource(source: SourceRef) {
    setOpenMaterial({ id: source.materialId, page: source.pageStart });
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

  function filterAndSort<T extends ListItem>(
    all: T[],
    nameOf: (item: T) => string,
    extraFilter?: (item: T) => boolean
  ): T[] {
    const q = query.trim().toLowerCase();
    const duplicates = duplicatesOnly ? findDuplicateIds(all, nameOf) : null;
    const filtered = all.filter((item) => {
      const day = item.created_at.slice(0, 10);
      return (
        (!subjectId || item.subject_id === subjectId) &&
        (!setIdFilter || item.set_id === setIdFilter) &&
        (!q || nameOf(item).toLowerCase().includes(q)) &&
        (!dateFrom || day >= dateFrom) &&
        (!dateTo || day <= dateTo) &&
        (!duplicates || duplicates.has(item.id)) &&
        (!extraFilter || extraFilter(item))
      );
    });
    return sortItems(filtered, sort, nameOf, locale);
  }

  function subjectGroups<T extends ListItem>(sorted: T[]): SubjectDayGroup<T>[] {
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

  function setGroups<T extends ListItem>(sorted: T[]): SetGroup<T>[] {
    return groupItemsBySet(sorted, subjects, locale, sort === "oldest" ? "asc" : "desc");
  }

  const typedSorted = filterAndSort(
    typedExercises,
    (item) => item.prompt,
    (item) =>
      (!difficultyFilter || item.difficulty === difficultyFilter) &&
      (!gradingModeFilter || item.grading_mode === gradingModeFilter)
  );
  const exerciseSorted = filterAndSort(
    exercises,
    (item) => item.prompt,
    (item) => !difficultyFilter || item.difficulty === difficultyFilter
  );
  const itemSorted = filterAndSort(items, (item) => item.statement);
  const counts = {
    exercises: exerciseSorted.length,
    truefalse: itemSorted.length,
    typed: typedSorted.length,
  };
  const activeFilterCount = [
    tab !== "truefalse" ? difficultyFilter : "",
    tab === "typed" ? gradingModeFilter : "",
    dateFrom,
    dateTo,
    duplicatesOnly ? "duplicates" : "",
    setIdFilter,
  ].filter(Boolean).length;

  function renderEmpty(emptyTitle: string, icon: "exercises" | "quizzes") {
    const action = sessionMode
      ? undefined
      : activeFilterCount > 0
        ? (
            <Button size="sm" onClick={clearFilters}>
              {t("clearFilters")}
            </Button>
          )
        : (
            <Button size="sm" onClick={() => openGenerate([tab])}>
              {t("generate")}
            </Button>
          );
    return (
      <EmptyState
        title={emptyTitle}
        hint={sessionMode ? undefined : t("generateHint")}
        action={action}
        icon={<NavIcon name={icon} className="h-5 w-5" />}
      />
    );
  }

  function renderGrouped<T extends ListItem>(
    groups: SubjectDayGroup<T>[],
    emptyTitle: string,
    icon: "exercises" | "quizzes",
    renderItem: (item: T, index: number) => ReactNode
  ) {
    if (groups.every((section) => section.dayGroups.every((day) => day.items.length === 0))) {
      return renderEmpty(emptyTitle, icon);
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

  function viewUngroupedDay(dayKey: string) {
    setGroup("none");
    setDateFrom(dayKey);
    setDateTo(dayKey);
    setSetIdFilter("");
    setShowFilters(true);
    updateQuery({ set: null });
  }

  function renderSessionCards<T extends ListItem>(groups: SetGroup<T>[], emptyTitle: string, icon: "exercises" | "quizzes") {
    if (groups.length === 0) {
      return renderEmpty(emptyTitle, icon);
    }

    const key = "sessions";
    const limit = visibleCounts[key] ?? PAGE_SIZE;
    const shown = groups.slice(0, limit);

    return (
      <div className="space-y-3">
        {shown.map((session) => (
          <Card key={session.key} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {session.color && (
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: session.color }} />
                  )}
                  <p className="font-medium">
                    {session.setId ? session.dayLabel || t("session") : t("ungrouped")}
                  </p>
                </div>
                <p className="mt-1 text-xs text-muted">
                  {session.subjectName && session.subjectName !== "—" ? `${session.subjectName} · ` : ""}
                  {session.timeLabel ? `${session.timeLabel} · ` : ""}
                  {t("itemsCount", { count: session.items.length })}
                </p>
              </div>
              {session.setId ? (
                <Link
                  href={`/practice/${session.setId}`}
                  className="inline-flex min-h-10 items-center justify-center rounded-xl bg-accent px-3 py-2 text-sm font-medium text-accent-foreground transition hover:opacity-90"
                >
                  {t("openSession")}
                </Link>
              ) : (
                <Button size="sm" variant="secondary" onClick={() => viewUngroupedDay(session.dayKey)}>
                  {t("showItems")}
                </Button>
              )}
            </div>
          </Card>
        ))}
        {groups.length > limit && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setVisibleCounts((prev) => ({ ...prev, [key]: limit + PAGE_SIZE }))}
          >
            {tc("showMore")}
          </Button>
        )}
        {limit > PAGE_SIZE && (
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
  }

  function renderList<T extends ListItem>(
    sorted: T[],
    emptyTitle: string,
    icon: "exercises" | "quizzes",
    renderItem: (item: T, index: number) => ReactNode
  ) {
    if (group === "set") {
      return renderSessionCards(setGroups(sorted), emptyTitle, icon);
    }
    return renderGrouped(subjectGroups(sorted), emptyTitle, icon, renderItem);
  }

  function checkbox(id: string) {
    if (sessionMode) return null;
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
    <div className="space-y-5">
      {!sessionMode && (
        <Card className="sticky top-0 z-10 p-4 backdrop-blur">
          <div className="flex flex-wrap items-end gap-3">
            <SubjectSelect
              value={subjectId}
              onChange={changeSubject}
              subjects={subjects}
              placeholder={t("selectSubject")}
              className="min-w-52"
            />
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
                  <option value="set">{tc("groupSet")}</option>
                </select>
              </label>
              <Button variant="ghost" size="sm" onClick={() => setShowFilters((v) => !v)}>
                {t("filters")}
                {activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
              </Button>
              <Button size="sm" onClick={() => openGenerate([tab])} disabled={busy}>
                {busy ? t("generating") : t("generate")}
              </Button>
            </div>
          </div>

          {showFilters && (
            <div className="mt-3 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                {tab !== "truefalse" && (
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
                )}
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
                {activeFilterCount > 0 && (
                  <Button size="sm" variant="ghost" onClick={clearFilters}>
                    {t("clearFilters")}
                  </Button>
                )}
              </div>

              <div className="space-y-2 rounded-xl border border-border bg-background p-3">
                <p className="text-xs font-semibold text-muted">{t("savedViews")}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={viewName}
                    onChange={(e) => setViewName(e.target.value)}
                    placeholder={t("viewNamePlaceholder")}
                    aria-label={t("viewNamePlaceholder")}
                    className="min-h-10 min-w-48 flex-1 rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-ring"
                  />
                  <Button size="sm" onClick={saveView} disabled={!viewName.trim()}>
                    {t("saveView")}
                  </Button>
                </div>
                {views.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={selectedViewId}
                      onChange={(e) => setSelectedViewId(e.target.value)}
                      aria-label={t("savedViews")}
                      className="min-h-10 min-w-48 rounded-xl border border-border bg-card px-2 py-1 text-sm outline-none focus:border-accent"
                    >
                      <option value="">{t("selectView")}</option>
                      {views.map((view) => (
                        <option key={view.id} value={view.id}>
                          {view.name}
                        </option>
                      ))}
                    </select>
                    <Button size="sm" variant="secondary" onClick={applyView} disabled={!selectedViewId}>
                      {t("applyView")}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={deleteView} disabled={!selectedViewId}>
                      {t("deleteView")}
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-muted">{t("noViews")}</p>
                )}
              </div>
            </div>
          )}

          {setIdFilter && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-accent/10 px-2 py-1 text-xs font-medium text-accent">
                {t("sessionFilter")}
              </span>
              <Button size="sm" variant="ghost" onClick={() => changeSetFilter("")}>
                {t("clearSessionFilter")}
              </Button>
            </div>
          )}

          {error && <span className="mt-2 block text-sm text-danger">{error}</span>}
        </Card>
      )}

      <div role="tablist" className="inline-flex rounded-xl border border-border bg-card p-1 shadow-soft">
        {TABS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => changeTab(id)}
            className={
              "min-h-10 rounded-lg px-3 py-1.5 text-sm font-medium transition " +
              (tab === id ? "bg-accent/10 text-accent ring-1 ring-accent/20" : "text-muted hover:text-foreground")
            }
          >
            {t(id === "truefalse" ? "trueFalse" : id)}
            <span className="ml-2 text-xs opacity-70">{counts[id]}</span>
          </button>
        ))}
      </div>

      {sessionMode && error && <p className="text-sm text-danger">{error}</p>}

      {!sessionMode && selected.size > 0 && (
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
        renderList(typedSorted, t("emptyTyped"), "exercises", (ex, index) => {
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
                    {!sessionMode && (
                      <button
                        type="button"
                        onClick={() => remove("typedexercises", ex.id)}
                        className="shrink-0 text-xs text-muted transition hover:text-danger"
                        title={t("deleteTyped")}
                        aria-label={t("deleteTyped")}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent">
                      {difficultyLabel(ex.difficulty)}
                    </span>
                    <span className="rounded-full bg-foreground/5 px-2 py-0.5 text-xs text-muted">
                      {gradingModeLabel(ex.grading_mode)}
                    </span>
                  </div>
                  {result && (
                    <SourceChips value={ex.source_refs} subjectId={ex.subject_id} onOpen={openSource} />
                  )}
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
        renderList(exerciseSorted, t("emptyExercises"), "exercises", (ex, index) => (
          <Card key={ex.id} className="p-4">
            <div className="flex items-start gap-2">
              {checkbox(ex.id)}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium">
                    <span className="mr-2 text-muted">{index + 1}.</span>
                    {ex.prompt}
                  </p>
                  {!sessionMode && (
                    <button
                      type="button"
                      onClick={() => remove("exercises", ex.id)}
                      className="shrink-0 text-xs text-muted transition hover:text-danger"
                      title={t("deleteExercise")}
                      aria-label={t("deleteExercise")}
                    >
                      ✕
                    </button>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent">
                    {difficultyLabel(ex.difficulty)}
                  </span>
                </div>
                {revealed[ex.id] && (
                  <SourceChips value={ex.source_refs} subjectId={ex.subject_id} onOpen={openSource} />
                )}
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
        renderList(itemSorted, t("emptyTrueFalse"), "quizzes", (item, index) => {
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
                    {!sessionMode && (
                      <button
                        type="button"
                        onClick={() => remove("truefalse", item.id)}
                        className="shrink-0 text-xs text-muted transition hover:text-danger"
                        title={t("deleteItem")}
                        aria-label={t("deleteItem")}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  {answered && (
                    <SourceChips value={item.source_refs} subjectId={item.subject_id} onOpen={openSource} />
                  )}
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

      {!sessionMode && generateOpen && (
        <PracticeGenerateModal
          open
          onClose={() => setGenerateOpen(false)}
          subjects={subjects}
          subjectId={subjectId}
          onSubjectChange={changeSubject}
          initialKinds={generateKinds}
          onJob={setJobId}
        />
      )}

      <MaterialPreviewModal
        materialId={openMaterial?.id ?? null}
        page={openMaterial?.page}
        onClose={() => setOpenMaterial(null)}
      />
    </div>
  );
}
