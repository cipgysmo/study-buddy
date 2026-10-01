"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { SubjectSelect, type SubjectOption } from "@/components/ui/subject-select";
import { TopicPicker } from "@/components/ui/topic-picker";
import { useJob } from "@/lib/use-jobs";

export function CreatePlanForm({ subjects }: { subjects: SubjectOption[] }) {
  const t = useTranslations("ExamPrep");
  const router = useRouter();
  const [subjectId, setSubjectId] = useState("");
  const [topicIds, setTopicIds] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [examDate, setExamDate] = useState("");
  const [targetGrade, setTargetGrade] = useState("");
  const [busy, setBusy] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState("");
  useJob(jobId, (settled) => {
    if (settled.status === "done") {
      setJobId(null);
      setBusy(false);
      if (settled.result) router.push(`/exam-prep/${settled.result}`);
    } else {
      setJobId(null);
      setBusy(false);
      setError(settled.error ?? "error");
    }
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!subjectId || !examDate || busy) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/study-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectId, title, examDate, targetGrade, topicIds }),
      });
      const d = (await r.json()) as { job?: { id: string }; error?: string };
      if (!r.ok || !d.job) throw new Error(d.error || "error");
      setJobId(d.job.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <SubjectSelect
          value={subjectId}
          onChange={(v) => {
            setSubjectId(v);
            setTopicIds([]);
          }}
          subjects={subjects}
          placeholder={t("selectSubject")}
        />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("titleLabel")}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
        <input
          type="date"
          value={examDate}
          onChange={(e) => setExamDate(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
        <input
          value={targetGrade}
          onChange={(e) => setTargetGrade(e.target.value)}
          placeholder={t("targetGrade")}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
      </div>
      <TopicPicker subjectId={subjectId} selected={topicIds} onChange={setTopicIds} />
      {error && <p className="text-sm text-red-500">{error}</p>}
      <button
        type="submit"
        disabled={busy || !subjectId || !examDate}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
      >
        {busy ? t("generating") : t("create")}
      </button>
    </form>
  );
}
