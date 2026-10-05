"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Topic {
  id: string;
  name: string;
}

export function TopicManager({
  subjectId,
  initial,
}: {
  subjectId: string;
  initial: Topic[];
}) {
  const t = useTranslations("Subjects");
  const [topics, setTopics] = useState<Topic[]>(initial);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/subjects/${subjectId}/topics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (r.ok) {
        const d = (await r.json()) as { topic: Topic };
        setTopics((prev) => [...prev, d.topic]);
        setName("");
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    await fetch(`/api/topics/${id}`, { method: "DELETE" });
    setTopics((prev) => prev.filter((x) => x.id !== id));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void add();
            }
          }}
          placeholder={t("topicPlaceholder")}
          className="flex-1 bg-background"
        />
        <Button onClick={() => void add()} disabled={busy || !name.trim()}>
          {t("addTopic")}
        </Button>
      </div>
      {topics.length === 0 ? (
        <p className="text-sm text-muted">{t("noTopics")}</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {topics.map((topic) => (
            <li
              key={topic.id}
              className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-medium"
            >
              {topic.name}
              <button
                onClick={() => void remove(topic.id)}
                aria-label={t("deleteTopic")}
                title={t("deleteTopic")}
                className="text-muted transition-colors hover:text-danger"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
