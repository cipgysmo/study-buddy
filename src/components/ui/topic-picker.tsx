"use client";

import { useEffect, useState } from "react";

interface Topic {
  id: string;
  name: string;
}

/**
 * Multi-select topic chips for a subject. Fetches the subject's topics and
 * lets the caller pick any subset; renders nothing until a subject is chosen
 * and it has topics.
 */
export function TopicPicker({
  subjectId,
  selected,
  onChange,
}: {
  subjectId: string;
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [loaded, setLoaded] = useState<{ subjectId: string; topics: Topic[] } | null>(null);

  useEffect(() => {
    if (!subjectId) return;
    let cancelled = false;
    fetch(`/api/subjects/${subjectId}/topics`)
      .then((r) => (r.ok ? r.json() : { topics: [] }))
      .then((d) => {
        if (!cancelled) setLoaded({ subjectId, topics: (d.topics as Topic[]) ?? [] });
      })
      .catch(() => {
        if (!cancelled) setLoaded({ subjectId, topics: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [subjectId]);

  if (!subjectId || !loaded || loaded.subjectId !== subjectId || loaded.topics.length === 0) {
    return null;
  }
  const topics = loaded.topics;

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {topics.map((topic) => {
        const active = selected.includes(topic.id);
        return (
          <button
            key={topic.id}
            type="button"
            onClick={() => toggle(topic.id)}
            aria-pressed={active}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              active
                ? "bg-accent text-accent-foreground"
                : "border border-border text-muted hover:border-accent hover:text-foreground"
            }`}
          >
            {topic.name}
          </button>
        );
      })}
    </div>
  );
}
