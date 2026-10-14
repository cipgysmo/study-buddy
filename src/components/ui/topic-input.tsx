"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

export function TopicInput({
  subjectId,
  value,
  onChange,
}: {
  subjectId: string;
  value: string[];
  onChange: (names: string[]) => void;
}) {
  const t = useTranslations("Subjects");
  const [draft, setDraft] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    if (!subjectId) return;
    let cancelled = false;
    fetch(`/api/subjects/${subjectId}/topics`)
      .then((r) => (r.ok ? r.json() : { topics: [] }))
      .then((d) => {
        if (!cancelled) {
          setSuggestions(((d.topics as { name: string }[]) ?? []).map((topic) => topic.name));
        }
      })
      .catch(() => {
        if (!cancelled) setSuggestions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [subjectId]);

  function addDraft() {
    const next = draft
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    if (next.length === 0) return;
    const merged = [...value];
    for (const name of next) {
      if (!merged.some((x) => x.toLowerCase() === name.toLowerCase())) merged.push(name);
    }
    onChange(merged);
    setDraft("");
  }

  function remove(name: string) {
    onChange(value.filter((x) => x !== name));
  }

  const listId = `topic-input-${subjectId || "none"}`;

  return (
    <div className="flex min-w-64 flex-wrap items-center gap-1.5">
      {value.map((name) => (
        <span
          key={name}
          className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-1 text-xs font-medium text-accent"
        >
          {name}
          <button
            type="button"
            onClick={() => remove(name)}
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
        list={listId}
        placeholder={t("topicPlaceholder")}
        className="min-w-40 flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs"
      />
      <datalist id={listId}>
        {suggestions.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
    </div>
  );
}
