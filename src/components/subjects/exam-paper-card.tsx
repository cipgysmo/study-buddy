"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Diagram } from "@/components/ui/diagram";
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
    status: "processing" | "ready" | "failed";
    parse_job_id: string | null;
  };
  parseStatus: "none" | "pending" | "running" | "done" | "failed" | "cancelled";
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
    <div className="mt-3 space-y-2 border-t border-border pt-3">
      <div className="flex flex-wrap items-center gap-2">
        {parsing ? (
          <span className="text-xs text-muted">{t("parsingQuestions")}</span>
        ) : parseStatus === "failed" || parseStatus === "cancelled" ? (
          <span className="flex flex-wrap items-center gap-2 text-xs text-danger">
            {parseError ?? t("parseFailed")}
            <Button variant="ghost" size="sm" onClick={() => void retryParse()}>
              {tc("retry")}
            </Button>
          </span>
        ) : questionCount > 0 ? (
          <span className="text-xs text-muted">{t("questionCount", { count: questionCount })}</span>
        ) : material.status === "ready" ? (
          <span className="text-xs text-muted">{t("noQuestions")}</span>
        ) : null}

        {questionCount > 0 && (
          <>
            <Button variant="secondary" size="sm" onClick={() => void toggleQuestions()}>
              {showQuestions ? t("hideQuestions") : t("viewQuestions")}
            </Button>
            <Button variant="primary" size="sm" disabled={generating} onClick={() => void generateSimilar()}>
              {generating ? tc("processing") : t("generateSimilar")}
            </Button>
          </>
        )}
        {genError && <span className="text-xs text-danger">{genError}</span>}
      </div>

      {showQuestions && questions && (
        <div className="space-y-2 border-t border-border pt-3">
          {questions.length === 0 ? (
            <p className="text-xs text-muted">{t("noQuestions")}</p>
          ) : (
            questions.map((q, i) => (
              <div key={q.id} className="rounded-lg border border-border bg-background p-3">
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
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2"
                  onClick={() => setRevealed((p) => ({ ...p, [q.id]: !p[q.id] }))}
                >
                  {revealed[q.id] ? t("hideAnswer") : t("showAnswer")}
                </Button>
                {revealed[q.id] && (
                  <div className="mt-2 rounded-lg border border-border bg-background p-3 text-sm">
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
