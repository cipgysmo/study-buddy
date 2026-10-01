"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

export function UploadMaterialForm({ subjectId }: { subjectId: string }) {
  const t = useTranslations("Subjects");
  const tc = useTranslations("Common");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, setPending] = useState<string[]>([]);
  const [isExam, setIsExam] = useState(false);

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0 || uploading) return;
    setUploading(true);
    const jobIds: string[] = [];
    try {
      // Uploads are independent; the server processes them one at a time in a queue.
      await Promise.all(
        Array.from(files).map(async (file) => {
          const form = new FormData();
          form.append("file", file);
          if (isExam) form.append("role", "exam");
          const r = await fetch(`/api/subjects/${subjectId}/materials`, {
            method: "POST",
            body: form,
          });
          if (r.ok) {
            const d = (await r.json()) as { job?: { id: string } };
            if (d.job) jobIds.push(d.job.id);
          }
        })
      );
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
    router.refresh();
    if (jobIds.length > 0) setPending((prev) => [...prev, ...jobIds]);
  }

  // Re-render the page once the background jobs for these uploads finish.
  useEffect(() => {
    if (pending.length === 0) return;
    let stop = false;
    async function tick() {
      try {
        const r = await fetch("/api/jobs", { cache: "no-store" });
        const d = (await r.json()) as { jobs: { id: string }[] };
        if (stop) return;
        const activeIds = new Set(d.jobs.map((j) => j.id));
        const remaining = pending.filter((id) => activeIds.has(id));
        if (remaining.length === 0) {
          setPending([]);
          router.refresh();
        } else if (remaining.length < pending.length) {
          setPending(remaining);
        }
      } catch {
        /* ignore */
      }
    }
    void tick();
    const iv = setInterval(() => void tick(), 2000);
    return () => {
      stop = true;
      clearInterval(iv);
    };
  }, [pending, router]);

  return (
    <div className="space-y-2">
      <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-muted">
        <input
          type="checkbox"
          checked={isExam}
          onChange={(e) => setIsExam(e.target.checked)}
          className="accent-[var(--color-accent)]"
        />
        {t("schoolExam")}
      </label>
      <label
        className={
          "flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-border bg-card px-4 py-6 text-sm text-muted transition-colors hover:border-accent " +
          (uploading ? "pointer-events-none opacity-60" : "")
        }
      >
        {uploading ? tc("loading") : t("upload")}
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="application/pdf,image/*,.txt,.md"
          className="hidden"
          onChange={(e) => onFiles(e.target.files)}
        />
      </label>
    </div>
  );
}
