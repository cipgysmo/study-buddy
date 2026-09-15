"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

interface Item {
  id: string;
  dayIndex: number;
  date: string;
  topic: string;
  instructions: string;
  done: boolean;
}

export function PlanTimeline({ items }: { items: Item[] }) {
  const t = useTranslations("ExamPrep");
  const [itemsState, setItemsState] = useState(items);

  async function toggle(item: Item) {
    const next = !item.done;
    setItemsState((prev) => prev.map((i) => (i.id === item.id ? { ...i, done: next } : i)));
    await fetch(`/api/plan-items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: next }),
    });
  }

  if (itemsState.length === 0) {
    return <p className="text-sm text-muted">{t("noItems")}</p>;
  }

  return (
    <ol className="space-y-3">
      {itemsState.map((item) => (
        <li key={item.id} className="flex gap-3 rounded-2xl border border-border bg-card p-4">
          <button
            onClick={() => toggle(item)}
            className={
              "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs " +
              (item.done
                ? "border-accent bg-accent text-accent-foreground"
                : "border-border text-muted")
            }
            aria-pressed={item.done}
          >
            {item.done ? "✓" : item.dayIndex}
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted">{item.date}</span>
              {item.dayIndex === 0 && (
                <span className="rounded bg-accent/10 px-1.5 py-0.5 text-xs text-accent">
                  {t("today")}
                </span>
              )}
            </div>
            <p className={"font-medium " + (item.done ? "text-muted line-through" : "")}>
              {item.topic}
            </p>
            <p className="mt-1 text-sm text-muted">{item.instructions}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
