"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

export interface ExplainableQuestion {
  prompt: string;
  options?: string[] | null;
  answer?: string | null;
  explanation?: string | null;
}

/**
 * On-demand tutor explanation for a single question. Fetches a one-shot
 * explanation and shows it inline.
 */
export function ExplainButton({ question }: { question: ExplainableQuestion }) {
  const t = useTranslations("Common");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [text, setText] = useState("");

  async function explain() {
    if (state === "loading") return;
    setState("loading");
    setText("");
    try {
      const r = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: question.prompt,
          options: question.options ?? undefined,
          answer: question.answer ?? undefined,
          explanation: question.explanation ?? undefined,
        }),
      });
      if (!r.ok) throw new Error("error");
      const d = (await r.json()) as { explanation: string };
      setText(d.explanation);
      setState("done");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="mt-2">
      <button
        onClick={() => void explain()}
        disabled={state === "loading"}
        className="text-sm text-accent hover:underline disabled:opacity-50"
      >
        {state === "loading" ? t("loading") : t("explain")}
      </button>
      {state === "done" && text && (
        <div className="mt-2 whitespace-pre-wrap rounded-xl bg-background p-3 text-sm">{text}</div>
      )}
      {state === "error" && <p className="mt-2 text-sm text-red-500">{t("error")}</p>}
    </div>
  );
}
