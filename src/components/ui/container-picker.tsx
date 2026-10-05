"use client";

import { useEffect, useState } from "react";

interface Container {
  id: string;
  name: string;
}

export function ContainerPicker({
  subjectId,
  selected,
  onChange,
}: {
  subjectId: string;
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [loaded, setLoaded] = useState<{ subjectId: string; containers: Container[] } | null>(null);

  useEffect(() => {
    if (!subjectId) return;
    let cancelled = false;
    fetch(`/api/subjects/${subjectId}/board`)
      .then((r) => (r.ok ? r.json() : { columns: [] }))
      .then((d) => {
        const containers = ((d.columns as { id: string; name: string }[]) ?? []).map((column) => ({
          id: column.id,
          name: column.name,
        }));
        if (!cancelled) setLoaded({ subjectId, containers });
      })
      .catch(() => {
        if (!cancelled) setLoaded({ subjectId, containers: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [subjectId]);

  if (!subjectId || !loaded || loaded.subjectId !== subjectId || loaded.containers.length === 0) {
    return null;
  }

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {loaded.containers.map((container) => {
        const active = selected.includes(container.id);
        return (
          <button
            key={container.id}
            type="button"
            onClick={() => toggle(container.id)}
            aria-pressed={active}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              active
                ? "bg-accent text-accent-foreground"
                : "border border-border text-muted hover:border-accent hover:text-foreground"
            }`}
          >
            {container.name}
          </button>
        );
      })}
    </div>
  );
}
