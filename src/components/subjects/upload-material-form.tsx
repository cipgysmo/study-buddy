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

const CHUNK_SIZE_BYTES = 8 * 1024 * 1024;
const CHUNK_THRESHOLD_BYTES = 8 * 1024 * 1024;

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
  const [progress, setProgress] = useState<{ name: string; percent: number } | null>(null);
  const [error, setError] = useState("");

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
    setError("");
    const jobIds: string[] = [];
    try {
      for (const file of Array.from(files)) {
        setProgress({ name: file.name, percent: 0 });
        try {
          const d =
            file.size > CHUNK_THRESHOLD_BYTES
              ? await uploadChunked(file)
              : await uploadDirect(file);
          if (d.job) jobIds.push(d.job.id);
        } catch (e) {
          setError(e instanceof Error ? e.message : t("uploadErrorUnknown"));
        }
      }
    } finally {
      setUploading(false);
      setProgress(null);
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

  async function uploadDirect(file: File): Promise<{ job?: { id: string } }> {
    const form = new FormData();
    form.append("file", file);
    if (isExam) form.append("role", "exam");
    const container = containerName.trim();
    if (container) form.append("containerName", container);
    const r = await fetch(`/api/subjects/${selectedSubjectId}/materials`, {
      method: "POST",
      body: form,
    });
    const d = (await r.json().catch(() => ({}))) as { job?: { id: string }; error?: string };
    if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
    return d;
  }

  async function uploadChunked(file: File): Promise<{ job?: { id: string } }> {
    const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE_BYTES));
    const createRes = await fetch(`/api/subjects/${selectedSubjectId}/uploads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: file.name,
        mime: file.type || "application/octet-stream",
        size: file.size,
        totalChunks,
        role: isExam ? "exam" : "notes",
        containerName: containerName.trim(),
      }),
    });
    const createData = (await createRes.json().catch(() => ({}))) as {
      upload?: { id: string };
      error?: string;
    };
    if (!createRes.ok || !createData.upload?.id) {
      throw new Error(createData.error || `HTTP ${createRes.status}`);
    }

    let uploadedBytes = 0;
    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE_BYTES;
      const blob = file.slice(start, Math.min(file.size, start + CHUNK_SIZE_BYTES));
      await uploadChunk(createData.upload.id, i, blob, (loaded) => {
        const percent = Math.min(99, Math.floor(((uploadedBytes + loaded) / file.size) * 100));
        setProgress({ name: file.name, percent });
      });
      uploadedBytes += blob.size;
      setProgress({ name: file.name, percent: Math.floor((uploadedBytes / file.size) * 100) });
    }

    const completeRes = await fetch(`/api/uploads/${createData.upload.id}/complete`, { method: "POST" });
    const completeData = (await completeRes.json().catch(() => ({}))) as {
      job?: { id: string };
      error?: string;
    };
    if (!completeRes.ok) throw new Error(completeData.error || `HTTP ${completeRes.status}`);
    return completeData;
  }

  function uploadChunk(uploadId: string, index: number, blob: Blob, onProgress: (loaded: number) => void) {
    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `/api/uploads/${uploadId}/chunk`);
      xhr.setRequestHeader("Content-Type", "application/octet-stream");
      xhr.setRequestHeader("X-Upload-Chunk-Index", String(index));
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(e.loaded);
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
          return;
        }
        let message = `HTTP ${xhr.status}`;
        try {
          const d = JSON.parse(xhr.responseText) as { error?: string };
          if (d.error) message = d.error;
        } catch {
          /* ignore */
        }
        reject(new Error(message));
      };
      xhr.onerror = () => reject(new Error("network_error"));
      xhr.send(blob);
    });
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
      <p className="text-xs text-muted">{t("uploadLargeHint")}</p>
      {progress && (
        <div className="space-y-1">
          <p className="text-xs text-muted">{t("uploadProgress", progress)}</p>
          <div className="h-1.5 overflow-hidden rounded-full bg-foreground/10">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${Math.max(0, Math.min(100, progress.percent))}%` }}
            />
          </div>
        </div>
      )}
      {error && <p className="text-xs text-danger">{t("uploadError", { message: error })}</p>}
    </Card>
  );
}
