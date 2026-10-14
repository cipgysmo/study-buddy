"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { RichText } from "@/components/ui/rich-text";

interface Subject {
  id: string;
  name: string;
}
interface Result {
  id: string;
  prompt: string;
  modelA: string;
  modelB: string;
  answerA: string;
  answerB: string;
  winner: "a" | "b" | "tie" | null;
  createdAt: string;
}

export function ArenaApp({ subjects, models }: { subjects: Subject[]; models: string[] }) {
  const t = useTranslations("Arena");
  const [question, setQuestion] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [modelA, setModelA] = useState(models[0] ?? "local-ai");
  const [modelB, setModelB] = useState(models[1] ?? models[0] ?? "local-ai");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [recent, setRecent] = useState<Result[]>([]);

  useEffect(() => {
    fetch("/api/arena")
      .then((r) => r.json())
      .then((d) => setRecent((d.results ?? []) as Result[]))
      .catch(() => {});
  }, []);

  const canCompare = useMemo(
    () => question.trim().length > 0 && modelA && modelB && !loading,
    [question, modelA, modelB, loading]
  );

  async function compare() {
    if (!canCompare) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const r = await fetch("/api/arena", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: question.trim(),
          subjectId: subjectId || null,
          modelA,
          modelB,
        }),
      });
      if (!r.ok) throw new Error(String(r.status));
      const d = await r.json();
      setResult(d.result as Result);
    } catch {
      setError(t("error"));
    } finally {
      setLoading(false);
    }
  }

  async function vote(winner: "a" | "b" | "tie") {
    if (!result) return;
    await fetch(`/api/arena/${result.id}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ winner }),
    }).catch(() => {});
    setResult({ ...result, winner });
    setRecent((prev) => [{ ...result, winner }, ...prev.filter((x) => x.id !== result.id)]);
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-wrap gap-2">
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className="rounded-lg border border-border bg-background px-2 py-1 text-sm"
          >
            <option value="">—</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            value={modelA}
            onChange={(e) => setModelA(e.target.value)}
            className="rounded-lg border border-border bg-background px-2 py-1 text-sm"
          >
            {models.map((m) => (
              <option key={m} value={m}>
                A · {m}
              </option>
            ))}
          </select>
          <select
            value={modelB}
            onChange={(e) => setModelB(e.target.value)}
            className="rounded-lg border border-border bg-background px-2 py-1 text-sm"
          >
            {models.map((m) => (
              <option key={m} value={m}>
                B · {m}
              </option>
            ))}
          </select>
        </div>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={t("placeholder")}
          rows={3}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <button
          onClick={compare}
          disabled={!canCompare}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
        >
          {loading ? t("thinking") : t("compare")}
        </button>
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>

      {result && (
        <div className="grid gap-4 md:grid-cols-2">
          {(["a", "b"] as const).map((side) => (
            <div
              key={side}
              className={
                "rounded-2xl border bg-card p-4 " +
                (result.winner === side ? "border-accent ring-1 ring-accent/30" : "border-border")
              }
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold">
                  {side === "a" ? t("answerA") : t("answerB")} ·{" "}
                  {side === "a" ? result.modelA : result.modelB}
                </span>
                {result.winner === side && <span className="text-xs text-accent">★</span>}
              </div>
              <RichText content={side === "a" ? result.answerA : result.answerB} />
            </div>
          ))}
          <div className="md:col-span-2 flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted">{t("pickWinner")}</span>
            <button onClick={() => vote("a")} className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-foreground/5">
              {t("winnerA")}
            </button>
            <button onClick={() => vote("b")} className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-foreground/5">
              {t("winnerB")}
            </button>
            <button onClick={() => vote("tie")} className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-foreground/5">
              {t("tie")}
            </button>
            {result.winner && <span className="text-xs text-accent">{t("voted")}</span>}
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-2 text-sm font-semibold text-muted">{t("recent")}</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-muted">{t("noRecent")}</p>
        ) : (
          <ul className="space-y-1">
            {recent.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{r.prompt}</span>
                <span className="shrink-0 text-xs text-muted">
                  {r.winner ? r.winner.toUpperCase() : "—"} · {r.modelA} vs {r.modelB}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
