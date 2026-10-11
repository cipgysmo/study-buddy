"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface LlmSettings {
  languageEnabled: boolean;
  baseUrl: string;
  model: string;
  apiKeySet: boolean;
  visionEnabled: boolean;
  visionBaseUrl: string;
  visionModel: string;
  visionApiKeySet: boolean;
  effectiveBaseUrl: string;
  effectiveModel: string;
  effectiveVisionBaseUrl: string;
  effectiveVisionModel: string;
}

export function ModelSettingsSection({ current }: { current: LlmSettings }) {
  const t = useTranslations("Admin");
  const router = useRouter();
  const [languageEnabled, setLanguageEnabled] = useState(current.languageEnabled);
  const [baseUrl, setBaseUrl] = useState(current.baseUrl);
  const [model, setModel] = useState(current.model);
  const [apiKey, setApiKey] = useState("");
  const [clearApiKey, setClearApiKey] = useState(false);

  const [visionEnabled, setVisionEnabled] = useState(current.visionEnabled);
  const [visionBaseUrl, setVisionBaseUrl] = useState(current.visionBaseUrl);
  const [visionModel, setVisionModel] = useState(current.visionModel);
  const [visionApiKey, setVisionApiKey] = useState("");
  const [clearVisionApiKey, setClearVisionApiKey] = useState(false);

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function save() {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const r = await fetch("/api/admin/llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          languageEnabled,
          baseUrl,
          model,
          apiKey: apiKey.trim() || undefined,
          clearApiKey,
          visionEnabled,
          visionBaseUrl,
          visionModel,
          visionApiKey: visionApiKey.trim() || undefined,
          clearVisionApiKey,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "error");
      setApiKey("");
      setVisionApiKey("");
      setClearApiKey(false);
      setClearVisionApiKey(false);
      setMessage(t("modelSettingsSaved"));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-4 p-5">
      <div>
        <h2 className="font-medium">{t("modelSettings")}</h2>
        <p className="mt-0.5 text-sm text-muted">{t("modelSettingsHint")}</p>
      </div>

      <div className="space-y-3 rounded-xl border border-border bg-background p-4">
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={languageEnabled}
            onChange={(e) => setLanguageEnabled(e.target.checked)}
            className="accent-[var(--color-accent)]"
          />
          {t("overrideLanguageModel")}
        </label>
        {languageEnabled && (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 sm:col-span-2">
              <span className="block text-xs font-medium text-muted">{t("languageBaseUrl")}</span>
              <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder={current.effectiveBaseUrl} />
            </label>
            <label className="space-y-1">
              <span className="block text-xs font-medium text-muted">{t("languageModel")}</span>
              <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder={current.effectiveModel} />
            </label>
            <label className="space-y-1">
              <span className="block text-xs font-medium text-muted">{t("languageApiKey")}</span>
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  if (e.target.value.trim()) setClearApiKey(false);
                }}
                placeholder={current.apiKeySet ? t("apiKeySet") : t("apiKeyOptional")}
                autoComplete="off"
              />
            </label>
            {current.apiKeySet && (
              <label className="flex cursor-pointer items-center gap-2 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  checked={clearApiKey}
                  onChange={(e) => {
                    setClearApiKey(e.target.checked);
                    if (e.target.checked) setApiKey("");
                  }}
                  className="accent-[var(--color-accent)]"
                />
                {t("removeApiKey")}
              </label>
            )}
          </div>
        )}
      </div>

      <div className="space-y-3 rounded-xl border border-border bg-background p-4">
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={visionEnabled}
            onChange={(e) => setVisionEnabled(e.target.checked)}
            className="accent-[var(--color-accent)]"
          />
          {t("overrideVisionModel")}
        </label>
        {visionEnabled && (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 sm:col-span-2">
              <span className="block text-xs font-medium text-muted">{t("visionBaseUrl")}</span>
              <Input
                value={visionBaseUrl}
                onChange={(e) => setVisionBaseUrl(e.target.value)}
                placeholder={current.effectiveVisionBaseUrl}
              />
            </label>
            <label className="space-y-1">
              <span className="block text-xs font-medium text-muted">{t("visionModel")}</span>
              <Input
                value={visionModel}
                onChange={(e) => setVisionModel(e.target.value)}
                placeholder={current.effectiveVisionModel}
              />
            </label>
            <label className="space-y-1">
              <span className="block text-xs font-medium text-muted">{t("visionApiKey")}</span>
              <Input
                type="password"
                value={visionApiKey}
                onChange={(e) => {
                  setVisionApiKey(e.target.value);
                  if (e.target.value.trim()) setClearVisionApiKey(false);
                }}
                placeholder={current.visionApiKeySet ? t("apiKeySet") : t("apiKeyOptional")}
                autoComplete="off"
              />
            </label>
            {current.visionApiKeySet && (
              <label className="flex cursor-pointer items-center gap-2 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  checked={clearVisionApiKey}
                  onChange={(e) => {
                    setClearVisionApiKey(e.target.checked);
                    if (e.target.checked) setVisionApiKey("");
                  }}
                  className="accent-[var(--color-accent)]"
                />
                {t("removeApiKey")}
              </label>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => void save()} disabled={busy}>
          {busy ? t("saving") : t("saveModelSettings")}
        </Button>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => {
            setLanguageEnabled(false);
            setBaseUrl("");
            setModel("");
            setApiKey("");
            setClearApiKey(true);
            setVisionEnabled(false);
            setVisionBaseUrl("");
            setVisionModel("");
            setVisionApiKey("");
            setClearVisionApiKey(true);
          }}
        >
          {t("useEnvDefaults")}
        </Button>
      </div>

      <p className="text-xs text-muted">
        {t("effectiveModels", {
          language: `${current.effectiveBaseUrl} · ${current.effectiveModel}`,
          vision: `${current.effectiveVisionBaseUrl} · ${current.effectiveVisionModel}`,
        })}
      </p>
      {message && <p className="text-sm text-muted">{message}</p>}
      {error && <p className="text-sm text-danger">{error}</p>}
    </Card>
  );
}
