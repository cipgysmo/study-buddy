"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface LlmSettings {
  baseUrl: string;
  model: string;
  visionModel: string;
  apiKeySet: boolean;
  effectiveBaseUrl: string;
  effectiveModel: string;
  effectiveVisionModel: string;
}

export function LlmSettingsSection({ current }: { current: LlmSettings }) {
  const t = useTranslations("Settings");
  const router = useRouter();
  const [baseUrl, setBaseUrl] = useState(current.baseUrl);
  const [model, setModel] = useState(current.model);
  const [visionModel, setVisionModel] = useState(current.visionModel);
  const [apiKey, setApiKey] = useState("");
  const [clearApiKey, setClearApiKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function save() {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const r = await fetch("/api/settings/llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl,
          model,
          visionModel,
          apiKey: apiKey.trim() || undefined,
          clearApiKey,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "error");
      setApiKey("");
      setClearApiKey(false);
      setMessage(t("llmSaved"));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="max-w-2xl space-y-4 p-5">
      <div>
        <h2 className="font-medium">{t("llm")}</h2>
        <p className="mt-0.5 text-sm text-muted">{t("llmHint")}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 sm:col-span-2">
          <span className="block text-xs font-medium text-muted">{t("llmBaseUrl")}</span>
          <Input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder={current.effectiveBaseUrl}
          />
        </label>
        <label className="space-y-1">
          <span className="block text-xs font-medium text-muted">{t("llmModel")}</span>
          <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder={current.effectiveModel} />
        </label>
        <label className="space-y-1">
          <span className="block text-xs font-medium text-muted">{t("llmVisionModel")}</span>
          <Input
            value={visionModel}
            onChange={(e) => setVisionModel(e.target.value)}
            placeholder={current.effectiveVisionModel}
          />
        </label>
        <label className="space-y-1 sm:col-span-2">
          <span className="block text-xs font-medium text-muted">{t("llmApiKey")}</span>
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value);
              if (e.target.value.trim()) setClearApiKey(false);
            }}
            placeholder={current.apiKeySet ? t("llmApiKeySet") : t("llmApiKeyOptional")}
            autoComplete="off"
          />
        </label>
      </div>

      {current.apiKeySet && (
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={clearApiKey}
            onChange={(e) => {
              setClearApiKey(e.target.checked);
              if (e.target.checked) setApiKey("");
            }}
            className="accent-[var(--color-accent)]"
          />
          {t("llmRemoveApiKey")}
        </label>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => void save()} disabled={busy}>
          {busy ? t("llmSaving") : t("llmSave")}
        </Button>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => {
            setBaseUrl("");
            setModel("");
            setVisionModel("");
            setApiKey("");
            setClearApiKey(true);
          }}
        >
          {t("llmUseEnv")}
        </Button>
      </div>

      <p className="text-xs text-muted">
        {t("llmEffective", {
          baseUrl: current.effectiveBaseUrl,
          model: current.effectiveModel,
          visionModel: current.effectiveVisionModel,
        })}
      </p>
      {message && <p className="text-sm text-muted">{message}</p>}
      {error && <p className="text-sm text-danger">{error}</p>}
    </Card>
  );
}
