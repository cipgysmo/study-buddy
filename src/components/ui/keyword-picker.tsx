"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

export function KeywordPicker({
  value,
  onChange,
  placeholder,
}: {
  value: string[];
  onChange: (keywords: string[]) => void;
  placeholder?: string;
}) {
  const t = useTranslations("Subjects");
  const [draft, setDraft] = useState("");

  function addDraft() {
    const next = draft
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    if (next.length === 0) return;
    const merged = [...value];
    for (const keyword of next) {
      if (!merged.some((x) => x.toLowerCase() === keyword.toLowerCase())) merged.push(keyword);
    }
    onChange(merged);
    setDraft("");
  }

  function remove(keyword: string) {
    onChange(value.filter((x) => x !== keyword));
  }

  return (
    <div className="flex min-w-64 flex-wrap items-center gap-1.5">
      {value.map((keyword) => (
        <span
          key={keyword}
          className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-1 text-xs font-medium text-accent"
        >
          {keyword}
          <button
            type="button"
            onClick={() => remove(keyword)}
            aria-label={t("removeKeyword")}
            className="cursor-pointer text-accent hover:text-foreground"
          >
            ×
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            addDraft();
          }
        }}
        onBlur={addDraft}
        placeholder={placeholder ?? t("keywordPlaceholder")}
        className="min-w-40 flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs"
      />
    </div>
  );
}
