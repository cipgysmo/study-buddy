"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function AdminLoginForm() {
  const t = useTranslations("Admin");
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!password || busy) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!r.ok) throw new Error("invalid");
      router.push("/admin");
      router.refresh();
    } catch {
      setError(t("invalidPassword"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-3 p-5">
      <div className="space-y-1">
        <label htmlFor="admin-password" className="block text-xs font-medium text-muted">
          {t("password")}
        </label>
        <Input
          id="admin-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void submit();
          }}
          autoComplete="current-password"
        />
      </div>
      <Button onClick={() => void submit()} disabled={busy || !password}>
        {busy ? t("loggingIn") : t("login")}
      </Button>
      {error && <p className="text-sm text-danger">{error}</p>}
    </Card>
  );
}
