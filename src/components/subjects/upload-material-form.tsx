"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

export function UploadMaterialForm({ subjectId }: { subjectId: string }) {
  const t = useTranslations("Subjects");
  const tc = useTranslations("Common");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0 || busy) return;
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append("file", file);
        await fetch(`/api/subjects/${subjectId}/materials`, { method: "POST", body: form });
      }
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <label
      className={
        "flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-border bg-card px-4 py-6 text-sm text-muted transition-colors hover:border-accent " +
        (busy ? "pointer-events-none opacity-60" : "")
      }
    >
      {busy ? tc("loading") : t("upload")}
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="application/pdf,image/*,.txt,.md"
        className="hidden"
        onChange={(e) => onFiles(e.target.files)}
      />
    </label>
  );
}
