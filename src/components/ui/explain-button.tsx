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
 * Reveals the explanation for a single question. Uses the pre-generated
 * explanation when available so the reveal is instant; only falls back to an
 * on-demand tutor explanation for legacy questions that have none.
 */
export function ExplainButton({ question }: { question: ExplainableQuestion }) {
  const t = useTranslations("Common");
  const pregenerated = question.explanation?.trim() ?? "";
  const [revealed, setRevealed] = useState(false);
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [text, setText] = useState("");

  async function toggle() {
    if (revealed) {
      setRevealed(false);
      return;
    }
    if (pregenerated) {
      setText(pregenerated);
      setRevealed(true);
      return;
    }
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
      setRevealed(true);
    } catch {
      setState("error");
    }
  }

  return (
    <div className="mt-2">
      <button
        onClick={() => void toggle()}
        disabled={state === "loading"}
        className="text-sm text-accent hover:underline disabled:opacity-50"
      >
        {revealed ? t("hideExplanation") : state === "loading" ? t("loading") : t("explain")}
      </button>
      {revealed && text && (
        <div className="mt-2 whitespace-pre-wrap rounded-xl bg-background p-3 text-sm">{text}</div>
      )}
      {state === "error" && <p className="mt-2 text-sm text-red-500">{t("error")}</p>}
    </div>
  );
}
