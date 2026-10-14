"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { GenerationScopePicker } from "@/components/ui/generation-scope-picker";
import { SubjectSelect, type SubjectOption } from "@/components/ui/subject-select";
import type { GenerationDifficulty } from "@/lib/generation";
import type { PracticeTab } from "@/lib/practice-types";

const KINDS: PracticeTab[] = ["exercises", "truefalse", "typed"];

export function PracticeGenerateModal({
  open,
  onClose,
  subjects,
  subjectId,
  onSubjectChange,
  initialKinds = ["exercises"],
  onJob,
}: {
  open: boolean;
  onClose: () => void;
  subjects: SubjectOption[];
  subjectId: string;
  onSubjectChange: (subjectId: string) => void;
  initialKinds?: PracticeTab[];
  onJob: (jobId: string) => void;
}) {
  const t = useTranslations("Practice");
  const tc = useTranslations("Common");
  const [kinds, setKinds] = useState<PracticeTab[]>(initialKinds);
  const [count, setCount] = useState(5);
  const [topicNames, setTopicNames] = useState<string[]>([]);
  const [columnIds, setColumnIds] = useState<string[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [customPrompt, setCustomPrompt] = useState("");
  const [difficulty, setDifficulty] = useState<GenerationDifficulty>("balanced");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, open]);

  function toggleKind(kind: PracticeTab) {
    setKinds((prev) => (prev.includes(kind) ? prev.filter((x) => x !== kind) : [...prev, kind]));
  }

  async function generate() {
    if (!subjectId || busy || kinds.length === 0) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/practice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectId,
          count,
          kinds,
          topicNames,
          columnIds,
          keywords,
          difficulty,
          customPrompt,
        }),
      });
      const d = (await r.json()) as { job?: { id: string }; error?: string };
      if (!r.ok || !d.job) throw new Error(d.error || "error");
      onJob(d.job.id);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t("generateTitle")}
    >
      <div
        className="max-h-full w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{t("generateTitle")}</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            {tc("close")}
          </Button>
        </div>

        <div className="mt-4 space-y-4">
          <SubjectSelect
            value={subjectId}
            onChange={onSubjectChange}
            subjects={subjects}
            placeholder={t("selectSubject")}
            className="w-full"
          />

          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted">{t("generateKinds")}</p>
            <div className="flex flex-wrap gap-2">
              {KINDS.map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => toggleKind(kind)}
                  className={
                    "min-h-10 rounded-xl border px-3 py-1.5 text-sm font-medium transition " +
                    (kinds.includes(kind)
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border text-muted hover:text-foreground")
                  }
                  aria-pressed={kinds.includes(kind)}
                >
                  {t(kind === "truefalse" ? "trueFalse" : kind)}
                </button>
              ))}
            </div>
          </div>

          <label className="block text-xs text-muted">
            {t("count")}
            <input
              type="number"
              min={1}
              max={20}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="ml-2 w-24 min-h-10 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-ring"
            />
          </label>

          <GenerationScopePicker
            subjectId={subjectId}
            topicNames={topicNames}
            onTopicNamesChange={setTopicNames}
            columnIds={columnIds}
            onColumnIdsChange={setColumnIds}
            keywords={keywords}
            onKeywordsChange={setKeywords}
            difficulty={difficulty}
            onDifficultyChange={setDifficulty}
            customPrompt={customPrompt}
            onCustomPromptChange={setCustomPrompt}
          />

          {error && <p className="text-sm text-danger">{error}</p>}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button onClick={() => void generate()} disabled={busy || !subjectId || kinds.length === 0}>
            {busy ? t("generating") : t("generate")}
          </Button>
        </div>
      </div>
    </div>
  );
}
