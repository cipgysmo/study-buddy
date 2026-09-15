"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

interface Subject {
  id: string;
  name: string;
}

export function ScanApp({ subjects }: { subjects: Subject[] }) {
  const t = useTranslations("Scan");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [subjectId, setSubjectId] = useState("");
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  async function onFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file || busy) return;
    setBusy(true);
    setError("");
    setCopied(false);
    try {
      const form = new FormData();
      form.append("file", file);
      if (subjectId) form.append("subjectId", subjectId);
      const r = await fetch("/api/scan", { method: "POST", body: form });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "error");
      setText(d.text || "");
      if (d.material) router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function copy() {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-4">
        <select
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="">{t("noSubject")}</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <label
          className={
            "flex cursor-pointer items-center rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground " +
            (busy ? "pointer-events-none opacity-60" : "")
          }
        >
          {busy ? t("processing") : t("upload")}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onFiles(e.target.files)}
          />
        </label>
        {error && <span className="text-sm text-red-500">{error}</span>}
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted">{t("result")}</h2>
          {text && (
            <button onClick={copy} className="text-sm text-accent hover:underline">
              {copied ? t("copied") : t("copy")}
            </button>
          )}
        </div>
        {text ? (
          <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-background p-4 text-sm">{text}</pre>
        ) : (
          <p className="mt-3 text-sm text-muted">{t("empty")}</p>
        )}
      </div>
    </div>
  );
}
