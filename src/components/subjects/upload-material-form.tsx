"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";

export function UploadMaterialForm({
  subjectId,
  containers = [],
}: {
  subjectId: string;
  containers?: { id: string; name: string }[];
}) {
  const t = useTranslations("Subjects");
  const tc = useTranslations("Common");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, setPending] = useState<string[]>([]);
  const [isExam, setIsExam] = useState(false);
  const [containerName, setContainerName] = useState("");

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0 || uploading) return;
    setUploading(true);
    const jobIds: string[] = [];
    try {
      await Promise.all(
        Array.from(files).map(async (file) => {
          const form = new FormData();
          form.append("file", file);
          if (isExam) form.append("role", "exam");
          const container = containerName.trim();
          if (container) form.append("containerName", container);
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

  const containerListId = `containers-${subjectId}`;

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <div className="space-y-1">
        <label htmlFor={containerListId} className="block text-xs font-medium text-muted">
          {t("uploadContainerLabel")}
        </label>
        <Input
          id={containerListId}
          list={containerListId}
          value={containerName}
          onChange={(e) => setContainerName(e.target.value)}
          placeholder={t("uploadContainerPlaceholder")}
          className="bg-background"
        />
        <datalist id={containerListId}>
          {containers.map((container) => (
            <option key={container.id} value={container.name} />
          ))}
        </datalist>
      </div>
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
          "flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-border bg-background px-4 py-8 text-sm text-muted transition-colors hover:border-accent hover:bg-accent/5 " +
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
