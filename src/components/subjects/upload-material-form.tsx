"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SubjectSelect, type SubjectOption } from "@/components/ui/subject-select";

interface ContainerOption {
  id: string;
  name: string;
}

export function UploadMaterialForm({
  subjectId,
  subjects = [],
  containers = [],
}: {
  subjectId?: string;
  subjects?: SubjectOption[];
  containers?: ContainerOption[];
}) {
  const t = useTranslations("Subjects");
  const tc = useTranslations("Common");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState(subjectId ?? "");
  const [uploading, setUploading] = useState(false);
  const [pending, setPending] = useState<string[]>([]);
  const [isExam, setIsExam] = useState(false);
  const [containerName, setContainerName] = useState("");
  const [fetchedContainers, setFetchedContainers] = useState<ContainerOption[]>([]);

  const fixedSubject = Boolean(subjectId);
  const loadedContainers = fixedSubject ? containers : fetchedContainers;
  const containerListId = `containers-${selectedSubjectId || "new"}`;

  useEffect(() => {
    if (fixedSubject || !selectedSubjectId) return;
    let cancelled = false;
    fetch(`/api/subjects/${selectedSubjectId}/board`)
      .then((r) => (r.ok ? r.json() : { columns: [] }))
      .then((d) => {
        if (cancelled) return;
        const next = ((d.columns as ContainerOption[]) ?? []).map((column) => ({
          id: column.id,
          name: column.name,
        }));
        setFetchedContainers(next);
      })
      .catch(() => {
        if (!cancelled) setFetchedContainers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [fixedSubject, selectedSubjectId]);

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0 || uploading || !selectedSubjectId) return;
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
          const r = await fetch(`/api/subjects/${selectedSubjectId}/materials`, {
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
    if (!fixedSubject) {
      const r = await fetch(`/api/subjects/${selectedSubjectId}/board`);
      if (r.ok) {
        const d = (await r.json()) as { columns?: ContainerOption[] };
        setFetchedContainers((d.columns ?? []).map((column) => ({ id: column.id, name: column.name })));
      }
    }
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

  return (
    <Card className="space-y-3 p-4">
      {!fixedSubject && (
        <div className="space-y-1">
          <label className="block text-xs font-medium text-muted">{t("uploadSubjectLabel")}</label>
          <SubjectSelect
            value={selectedSubjectId}
            onChange={(v) => {
              setSelectedSubjectId(v);
              setContainerName("");
              setFetchedContainers([]);
            }}
            subjects={subjects}
            placeholder={t("uploadSubjectPlaceholder")}
          />
        </div>
      )}
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
          disabled={!selectedSubjectId}
        />
        <datalist id={containerListId}>
          {loadedContainers.map((container) => (
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
          (!selectedSubjectId || uploading ? "pointer-events-none opacity-60" : "")
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
    </Card>
  );
}
