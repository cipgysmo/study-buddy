"use client";

import { useCallback, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { GenerationScopePicker } from "@/components/ui/generation-scope-picker";
import { NavIcon } from "@/components/shell/nav-icons";
import { SubjectSelect, type SubjectOption } from "@/components/ui/subject-select";
import { DeleteButton } from "@/components/subjects/delete-button";
import type { GenerationDifficulty } from "@/lib/generation";
import { groupItemsBySubjectAndDay } from "@/lib/list-view";
import { useJob } from "@/lib/use-jobs";

interface Card {
  id: string;
  front: string;
  back: string;
}

interface AllCard extends Card {
  subject_id: string;
  created_at: string;
}

export function FlashcardsApp({
  subjects,
  initialDue,
  allCards = [],
  initialSubjectId = "",
}: {
  subjects: SubjectOption[];
  initialDue: Card[];
  allCards?: AllCard[];
  initialSubjectId?: string;
}) {
  const t = useTranslations("Flashcards");
  const locale = useLocale();
  const [subjectId, setSubjectId] = useState(initialSubjectId);
  const [topicIds, setTopicIds] = useState<string[]>([]);
  const [columnIds, setColumnIds] = useState<string[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [customPrompt, setCustomPrompt] = useState("");
  const [difficulty, setDifficulty] = useState<GenerationDifficulty>("balanced");
  const [count, setCount] = useState(10);
  const [busy, setBusy] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [due, setDue] = useState<Card[]>(initialDue);
  const [revealed, setRevealed] = useState(false);
  const loadDue = useCallback(async (sid: string) => {
    const r = await fetch(`/api/flashcards/due?subjectId=${sid || ""}`);
    const d = await r.json();
    setDue(d.flashcards.map((c: Card) => ({ id: c.id, front: c.front, back: c.back })));
    setRevealed(false);
  }, []);

  useJob(jobId, (settled) => {
    if (settled.status === "done") {
      setJobId(null);
      setBusy(false);
      void loadDue(subjectId);
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
      const r = await fetch("/api/flashcards", {
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

  async function review(rating: number) {
    if (due.length === 0) return;
    const card = due[0];
    await fetch(`/api/flashcards/${card.id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating }),
    });
    // Re-queue "Again" within the session; drop the rest.
    setDue((prev) => (rating === 1 ? [...prev.slice(1), prev[0]] : prev.slice(1)));
    setRevealed(false);
  }

  const current = due[0];
  const filteredAllCards = subjectId ? allCards.filter((c) => c.subject_id === subjectId) : allCards;
  const allCardGroups = groupItemsBySubjectAndDay(filteredAllCards, subjects, locale);

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
            void loadDue(v);
          }}
          subjects={subjects}
          placeholder={t("selectSubject")}
          className="min-w-52"
        />
        <input
          type="number"
          min={1}
          max={50}
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
          className="w-20 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-ring"
        />
        <Button onClick={generate} disabled={busy || !subjectId}>
          {busy ? t("generating") : t("generate")}
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
        customPrompt={customPrompt}
        onCustomPromptChange={setCustomPrompt}
      />

      <div>
        <p className="mb-3 text-sm text-muted">
          {due.length} {t("due")}
        </p>
        {!current ? (
          <EmptyState
            title={t("noDue")}
            icon={<NavIcon name="flashcards" className="h-5 w-5" />}
          />
        ) : (
          <Card className="p-6">
            <div className="mb-2 flex items-start justify-between gap-3">
              <p className="min-h-[3rem] text-lg font-medium">{current.front}</p>
              <DeleteButton
                href={`/api/flashcards/${current.id}`}
                label={t("deleteCard")}
                onDeleted={() => setDue((prev) => prev.slice(1))}
              />
            </div>
            {revealed && (
              <p className="mt-4 rounded-xl bg-foreground/5 p-4 text-sm">{current.back}</p>
            )}
            <div className="mt-6 flex flex-wrap gap-2">
              {!revealed ? (
                <Button onClick={() => setRevealed(true)}>{t("showAnswer")}</Button>
              ) : (
                <>
                  <Button variant="secondary" onClick={() => review(1)}>
                    {t("again")}
                  </Button>
                  <Button variant="secondary" onClick={() => review(2)}>
                    {t("hard")}
                  </Button>
                  <Button variant="secondary" onClick={() => review(3)}>
                    {t("good")}
                  </Button>
                  <Button variant="secondary" onClick={() => review(4)}>
                    {t("easy")}
                  </Button>
                </>
              )}
            </div>
          </Card>
        )}
      </div>

      {allCards.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">{t("allCards")}</h2>
          <div className="space-y-5">
            {allCardGroups.map((section) => (
              <section key={section.subjectId ?? "all"} className="space-y-3">
                {section.subjectName && (
                  <div className="flex items-center gap-2">
                    {section.color && (
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: section.color }} />
                    )}
                    <h3 className="text-sm font-semibold">{section.subjectName}</h3>
                  </div>
                )}
                {section.dayGroups.map((day) => (
                  <div key={day.dayKey} className="space-y-2">
                    {(day.dayLabel || day.timeLabel) && (
                      <p className="text-xs font-medium text-muted">
                        {day.dayLabel}
                        {day.timeLabel ? ` · ${day.timeLabel}` : ""}
                        <span className="ml-2 opacity-70">({day.items.length})</span>
                      </p>
                    )}
                    <ul className="grid gap-2 sm:grid-cols-2">
                      {day.items.map((card) => (
                        <li
                          key={card.id}
                          className="rounded-xl border border-border bg-card px-3 py-2 text-sm"
                        >
                          <span className="block truncate font-medium">{card.front}</span>
                          <span className="mt-0.5 block truncate text-xs text-muted">{card.back}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </section>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
