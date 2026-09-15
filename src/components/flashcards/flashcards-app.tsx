"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

interface Subject {
  id: string;
  name: string;
}
interface Card {
  id: string;
  front: string;
  back: string;
}

export function FlashcardsApp({
  subjects,
  initialDue,
}: {
  subjects: Subject[];
  initialDue: Card[];
}) {
  const t = useTranslations("Flashcards");
  const [subjectId, setSubjectId] = useState("");
  const [count, setCount] = useState(10);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [due, setDue] = useState<Card[]>(initialDue);
  const [revealed, setRevealed] = useState(false);

  async function loadDue(sid: string) {
    const r = await fetch(`/api/flashcards/due?subjectId=${sid || ""}`);
    const d = await r.json();
    setDue(d.flashcards.map((c: Card) => ({ id: c.id, front: c.front, back: c.back })));
    setRevealed(false);
  }

  async function generate() {
    if (!subjectId || busy) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectId, count }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "error");
      await loadDue(subjectId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function review(quality: number) {
    if (due.length === 0) return;
    const card = due[0];
    await fetch(`/api/flashcards/${card.id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quality }),
    });
    // Re-queue failures within the session; drop successes.
    setDue((prev) => (quality < 3 ? [...prev.slice(1), prev[0]] : prev.slice(1)));
    setRevealed(false);
  }

  const current = due[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-4">
        <select
          value={subjectId}
          onChange={(e) => {
            const v = e.target.value;
            setSubjectId(v);
            loadDue(v);
          }}
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
          max={50}
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
          className="w-20 rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
        <button
          onClick={generate}
          disabled={busy || !subjectId}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
        >
          {busy ? t("generating") : t("generate")}
        </button>
        {error && <span className="text-sm text-red-500">{error}</span>}
      </div>

      <div>
        <p className="mb-3 text-sm text-muted">
          {due.length} {t("due")}
        </p>
        {!current ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-muted">
            {t("noDue")}
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-6">
            <p className="min-h-[3rem] text-lg font-medium">{current.front}</p>
            {revealed && (
              <p className="mt-4 rounded-xl bg-foreground/5 p-4 text-sm">{current.back}</p>
            )}
            <div className="mt-6 flex flex-wrap gap-2">
              {!revealed ? (
                <button
                  onClick={() => setRevealed(true)}
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground"
                >
                  {t("showAnswer")}
                </button>
              ) : (
                <>
                  <button onClick={() => review(1)} className="rounded-lg border border-border px-4 py-2 text-sm">
                    {t("again")}
                  </button>
                  <button onClick={() => review(3)} className="rounded-lg border border-border px-4 py-2 text-sm">
                    {t("hard")}
                  </button>
                  <button onClick={() => review(4)} className="rounded-lg border border-border px-4 py-2 text-sm">
                    {t("good")}
                  </button>
                  <button onClick={() => review(5)} className="rounded-lg border border-border px-4 py-2 text-sm">
                    {t("easy")}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
