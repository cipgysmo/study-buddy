"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Diagram } from "@/components/ui/diagram";
import { MaterialImage } from "@/components/subjects/material-image";
import { MaterialStatus } from "@/components/subjects/material-status";
import { DeleteButton } from "@/components/subjects/delete-button";
import { useJob } from "@/lib/use-jobs";

interface ExamQuestion {
  id: string;
  prompt: string;
  options: string[] | null;
  answer: string | null;
  explanation: string | null;
  diagram: string | null;
}

export function ExamPaperCard({
  material,
  parseStatus,
  parseError,
  questionCount,
}: {
  material: {
    id: string;
    filename: string;
    kind: string;
    status: "processing" | "ready" | "failed";
    error: string | null;
    job_id: string | null;
    parse_job_id: string | null;
  };
  parseStatus: "none" | "pending" | "running" | "done" | "failed";
  parseError: string | null;
  questionCount: number;
}) {
  const t = useTranslations("Subjects");
  const tc = useTranslations("Common");
  const router = useRouter();
  const [showQuestions, setShowQuestions] = useState(false);
  const [questions, setQuestions] = useState<ExamQuestion[] | null>(null);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [generating, setGenerating] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [genError, setGenError] = useState("");

  useJob(jobId, (settled) => {
    setJobId(null);
    setGenerating(false);
    if (settled.status === "done") {
      // The new timed exam appears in the mock exams list.
      router.push("/mock-exams");
    } else {
      setGenError(settled.error ?? "error");
    }
  });

  async function toggleQuestions() {
    const next = !showQuestions;
    setShowQuestions(next);
    if (next && questions === null) {
      const r = await fetch(`/api/materials/${material.id}/questions`);
      if (r.ok) {
        const d = (await r.json()) as { questions: ExamQuestion[] };
        setQuestions(d.questions);
      }
    }
  }

  async function generateSimilar() {
    if (generating) return;
    setGenerating(true);
    setGenError("");
    try {
      const r = await fetch(`/api/materials/${material.id}/similar-exam`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const d = (await r.json()) as { job?: { id: string }; error?: string };
      if (!r.ok || !d.job) throw new Error(d.error || "error");
      setJobId(d.job.id);
    } catch (e) {
      setGenError(e instanceof Error ? e.message : String(e));
      setGenerating(false);
    }
  }

  async function retryParse() {
    if (!material.parse_job_id) return;
    await fetch(`/api/jobs/${material.parse_job_id}/retry`, { method: "POST" });
    router.refresh();
  }

  const parsing = parseStatus === "pending" || parseStatus === "running";

  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-3">
          {material.kind === "image" && (
            <MaterialImage src={`/api/materials/${material.id}`} alt={material.filename} />
          )}
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{material.filename}</span>
            <span className="block truncate text-xs text-muted">{t("examPaper")}</span>
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <MaterialStatus status={material.status} error={material.error} jobId={material.job_id} />
          <DeleteButton href={`/api/materials/${material.id}`} label={t("deleteMaterial")} />
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {parsing ? (
          <span className="text-sm text-muted">{t("parsingQuestions")}</span>
        ) : parseStatus === "failed" ? (
          <span className="flex items-center gap-2 text-sm text-danger">
            {parseError ?? t("parseFailed")}
            <button onClick={() => void retryParse()} className="text-accent hover:underline">
              {tc("retry")}
            </button>
          </span>
        ) : questionCount > 0 ? (
          <span className="text-sm text-muted">{t("questionCount", { count: questionCount })}</span>
        ) : material.status === "ready" ? (
          <span className="text-sm text-muted">{t("noQuestions")}</span>
        ) : null}

        {questionCount > 0 && (
          <>
            <button
              onClick={() => void toggleQuestions()}
              className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:border-accent"
            >
              {showQuestions ? t("hideQuestions") : t("viewQuestions")}
            </button>
            <button
              onClick={() => void generateSimilar()}
              disabled={generating}
              className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground disabled:opacity-50"
            >
              {generating ? tc("processing") : t("generateSimilar")}
            </button>
          </>
        )}
        {genError && <span className="text-sm text-red-500">{genError}</span>}
      </div>

      {showQuestions && questions && (
        <div className="mt-3 space-y-3 border-t border-border pt-3">
          {questions.length === 0 ? (
            <p className="text-sm text-muted">{t("noQuestions")}</p>
          ) : (
            questions.map((q, i) => (
              <div key={q.id} className="rounded-xl bg-background p-3">
                <p className="text-sm font-medium">
                  {i + 1}. {q.prompt}
                </p>
                {q.diagram && (
                  <div className="mt-2">
                    <Diagram svg={q.diagram} />
                  </div>
                )}
                {q.options && q.options.length > 0 && (
                  <ul className="mt-2 space-y-1 text-sm">
                    {q.options.map((o, oi) => (
                      <li key={oi}>
                        {String.fromCharCode(65 + oi)}. {o}
                      </li>
                    ))}
                  </ul>
                )}
                <button
                  onClick={() => setRevealed((p) => ({ ...p, [q.id]: !p[q.id] }))}
                  className="mt-2 text-sm text-accent hover:underline"
                >
                  {revealed[q.id] ? t("hideAnswer") : t("showAnswer")}
                </button>
                {revealed[q.id] && (
                  <div className="mt-2 rounded-lg bg-foreground/5 p-3 text-sm">
                    {q.answer && (
                      <p>
                        <span className="font-medium">{t("answer")}:</span> {q.answer}
                      </p>
                    )}
                    {q.explanation && (
                      <p className="mt-1 text-muted">
                        <span className="font-medium">{t("explanation")}:</span> {q.explanation}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
