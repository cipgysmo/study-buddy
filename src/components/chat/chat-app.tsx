"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { TopicPicker } from "@/components/ui/topic-picker";
import { RichText } from "@/components/ui/rich-text";
import { speak, stopSpeaking, useSpeechRecognition } from "@/lib/use-voice";

interface Session {
  id: string;
  title: string;
  subject_id: string | null;
}
interface Subject {
  id: string;
  name: string;
}
interface AttachmentMeta {
  id: string;
  kind: "image" | "pdf";
  name: string;
  mime: string;
  url: string;
}
interface Msg {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachments?: AttachmentMeta[] | null;
}

const TMP_USER = "tmp-user";
const TMP_ASST = "tmp-asst";

export function ChatApp({
  initialSessions,
  subjects,
  initialSubjectId = "",
  initialTopicIds = [],
  initialPrompt = "",
}: {
  initialSessions: Session[];
  subjects: Subject[];
  initialSubjectId?: string;
  initialTopicIds?: string[];
  initialPrompt?: string;
}) {
  const t = useTranslations("Chat");
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>(initialSessions);
  // A chapter "ask tutor" link starts a clean thread rather than reusing one.
  const [activeId, setActiveId] = useState<string | null>(
    initialPrompt ? null : (initialSessions[0]?.id ?? null)
  );
  const [subjectId, setSubjectId] = useState<string>(initialSubjectId);
  const [topicIds, setTopicIds] = useState<string[]>(initialTopicIds);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState(initialPrompt);
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<AttachmentMeta[]>([]);
  const [uploading, setUploading] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);

  const locale = useLocale();
  const voiceLang = locale === "cs" ? "cs-CZ" : "en-GB";
  const rec = useSpeechRecognition(voiceLang);
  const [oralMode, setOralMode] = useState(false);
  const oralRef = useRef(false);
  oralRef.current = oralMode;

  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/chat/sessions/${activeId}/messages`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setMessages(d.messages as Msg[]);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [activeId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function createSession(): Promise<string> {
    const r = await fetch("/api/chat/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subjectId: subjectId || null }),
    });
    const d = await r.json();
    setSessions((prev) => [d.session, ...prev]);
    return d.session.id as string;
  }

  async function newSession() {
    const id = await createSession();
    setActiveId(id);
  }

  async function removeSession(id: string) {
    if (!window.confirm(t("deleteConfirm"))) return;
    await fetch(`/api/chat/sessions/${id}`, { method: "DELETE" });
    const next = sessions.filter((s) => s.id !== id);
    setSessions(next);
    if (id === activeId) setActiveId(next[0]?.id ?? null);
  }

  async function ensureSession(): Promise<string> {
    if (activeId) return activeId;
    return createSession();
  }

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setAttachError(null);
    setUploading(true);
    try {
      const sessionId = await ensureSession();
      setActiveId(sessionId);
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append("file", file);
        const r = await fetch(`/api/chat/sessions/${sessionId}/attachments`, {
          method: "POST",
          body: form,
        });
        if (!r.ok) {
          const d = await r.json().catch(() => ({}));
          setAttachError(d.error === "too_large" ? t("attachmentTooLarge") : t("attachmentUnsupported"));
          continue;
        }
        const d = await r.json();
        setPending((prev) => [...prev, d.attachment as AttachmentMeta]);
      }
    } catch {
      setAttachError(t("attachmentUnsupported"));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
      if (cameraRef.current) cameraRef.current.value = "";
    }
  }

  function removePending(id: string) {
    setPending((prev) => prev.filter((a) => a.id !== id));
  }

  function dictate() {
    if (rec.listening) {
      rec.stop();
      return;
    }
    stopSpeaking();
    rec.start((final) => setInput((prev) => (prev ? prev + " " : "") + final));
  }

  function listenAuto() {
    rec.start((final) => {
      if (final) void send(final);
    });
  }

  async function send(textArg?: string) {
    const content = (textArg ?? input).trim();
    if ((!content && pending.length === 0) || streaming) return;

    let sessionId = activeId;
    if (!sessionId) sessionId = await createSession();
    setActiveId(sessionId);

    const sentAttachments = pending;
    setInput("");
    setPending([]);
    setMessages((prev) => [
      ...prev,
      { id: TMP_USER, role: "user", content, attachments: sentAttachments },
      { id: TMP_ASST, role: "assistant", content: "" },
    ]);
    setStreaming(true);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(`/api/chat/sessions/${sessionId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          subjectId: subjectId || null,
          topicIds,
          attachmentIds: sentAttachments.map((a) => a.id),
        }),
        signal: controller.signal,
      });
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let asstFull = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf("\n\n")) !== -1) {
          const raw = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const line = raw.trim();
          if (!line.startsWith("data:")) continue;
          const payload = JSON.parse(line.slice(5).trim());
          if (payload.type === "delta") {
            asstFull += payload.content;
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last && last.id === TMP_ASST)
                next[next.length - 1] = { ...last, content: last.content + payload.content };
              return next;
            });
          } else if (payload.type === "done") {
            setMessages((prev) =>
              prev.map((m) => (m.id === TMP_ASST ? { ...m, id: payload.messageId } : m))
            );
            if (oralRef.current) {
              speak(asstFull, voiceLang, () => listenAuto());
            }
          } else if (payload.type === "error") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === TMP_ASST
                  ? { ...m, content: `${m.content}\n\n[${t("error")}] ${payload.message}` }
                  : m
              )
            );
          }
        }
      }
    } catch (e) {
      if (controller.signal.aborted) {
        // Stopped by the user: keep the partial answer, drop an empty bubble.
        setMessages((prev) => prev.filter((m) => !(m.id === TMP_ASST && m.content === "")));
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === TMP_ASST
              ? { ...m, content: `${m.content}\n\n[${t("error")}] ${String(e)}` }
              : m
          )
        );
      }
    } finally {
      abortRef.current = null;
      setStreaming(false);
      router.refresh();
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  return (
    <div className="flex h-[70vh] gap-4">
      <aside className="w-52 shrink-0 space-y-1 overflow-y-auto">
        <button
          onClick={newSession}
          className="mb-2 w-full rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground"
        >
          {t("newChat")}
        </button>
        {sessions.map((s) => (
          <div key={s.id} className="flex items-center gap-1">
            <button
              onClick={() => setActiveId(s.id)}
              className={
                "min-w-0 flex-1 truncate rounded-lg px-3 py-2 text-left text-sm " +
                (s.id === activeId
                  ? "bg-foreground/10 font-medium"
                  : "text-muted hover:bg-foreground/5")
              }
            >
              {s.title}
            </button>
            <button
              onClick={() => void removeSession(s.id)}
              aria-label={t("deleteChat")}
              title={t("deleteChat")}
              className="shrink-0 rounded-md px-1.5 py-1 text-xs text-muted transition-colors hover:text-danger"
            >
              ✕
            </button>
          </div>
        ))}
      </aside>

      <section className="flex min-w-0 flex-1 flex-col rounded-2xl border border-border bg-card">
        <div className="space-y-2 border-b border-border px-4 py-2">
          <select
            value={subjectId}
            onChange={(e) => {
              setSubjectId(e.target.value);
              setTopicIds([]);
            }}
            className="rounded-lg border border-border bg-background px-2 py-1 text-sm"
          >
            <option value="">{t("noSubject")}</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <TopicPicker subjectId={subjectId} selected={topicIds} onChange={setTopicIds} />
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.length === 0 && (
            <p className="text-sm text-muted">{t("empty")}</p>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              className={
                "max-w-[80%] rounded-2xl px-4 py-2 text-sm " +
                (m.role === "user"
                  ? "ml-auto whitespace-pre-wrap bg-accent text-accent-foreground"
                  : "bg-foreground/5")
              }
            >
              {m.attachments && m.attachments.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {m.attachments.map((a) =>
                    a.kind === "image" ? (
                      <a key={a.id} href={a.url} target="_blank" rel="noreferrer">
                        <img
                          src={a.url}
                          alt={a.name}
                          className="max-h-40 rounded-lg border border-border object-contain"
                        />
                      </a>
                    ) : (
                      <a
                        key={a.id}
                        href={a.url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-md bg-foreground/10 px-2 py-1 text-xs underline"
                      >
                        📄 {a.name}
                      </a>
                    )
                  )}
                </div>
              )}
              {m.role === "assistant" ? (
                <>
                  <RichText content={m.content} />
                  {m.content.trim() && (
                    <button
                      onClick={() => speak(m.content, voiceLang)}
                      aria-label={t("readAloud")}
                      title={t("readAloud")}
                      className="mt-1 text-xs text-muted transition-colors hover:text-foreground"
                    >
                      🔊 {t("readAloud")}
                    </button>
                  )}
                </>
              ) : (
                m.content
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-border p-3">
          {pending.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {pending.map((a) => (
                <div key={a.id} className="relative">
                  {a.kind === "image" ? (
                    <img
                      src={a.url}
                      alt={a.name}
                      className="max-h-20 rounded-lg border border-border object-contain"
                    />
                  ) : (
                    <span className="rounded-md bg-foreground/10 px-2 py-1 text-xs">📄 {a.name}</span>
                  )}
                  <button
                    onClick={() => removePending(a.id)}
                    aria-label={t("removeAttachment")}
                    className="absolute -right-1.5 -top-1.5 rounded-full bg-danger px-1.5 text-xs text-white"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
          {attachError && <p className="mb-2 text-xs text-danger">{attachError}</p>}
          <div className="flex gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              multiple
              className="hidden"
              onChange={(e) => void onFiles(e.target.files)}
            />
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => void onFiles(e.target.files)}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading || streaming}
              aria-label={t("attach")}
              title={t("attach")}
              className="rounded-lg border border-border px-3 py-2 text-sm text-muted transition-colors hover:text-foreground disabled:opacity-50"
            >
              📎
            </button>
            <button
              onClick={() => cameraRef.current?.click()}
              disabled={uploading || streaming}
              aria-label={t("attachCamera")}
              title={t("attachCamera")}
              className="rounded-lg border border-border px-3 py-2 text-sm text-muted transition-colors hover:text-foreground disabled:opacity-50"
            >
              📷
            </button>
            {rec.supported && (
              <button
                onClick={dictate}
                disabled={streaming}
                aria-label={t("dictate")}
                title={t("dictate")}
                className={
                  "rounded-lg border px-3 py-2 text-sm transition-colors disabled:opacity-50 " +
                  (rec.listening
                    ? "border-danger bg-danger/10 text-danger"
                    : "border-border text-muted hover:text-foreground")
                }
              >
                🎤
              </button>
            )}
            {rec.supported && (
              <button
                onClick={() => {
                  const next = !oralMode;
                  setOralMode(next);
                  if (!next) {
                    stopSpeaking();
                    rec.stop();
                  }
                }}
                aria-pressed={oralMode}
                aria-label={t("oralMode")}
                title={t("oralMode")}
                className={
                  "rounded-lg border px-3 py-2 text-sm transition-colors " +
                  (oralMode
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border text-muted hover:text-foreground")
                }
              >
                🗣
              </button>
            )}
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={
                rec.listening ? rec.interim || t("listening") : uploading ? t("uploading") : t("placeholder")
              }
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
            />
            {streaming ? (
              <button
                onClick={stop}
                className="rounded-lg bg-danger px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
              >
                {t("stop")}
              </button>
            ) : (
              <button
                onClick={() => send()}
                disabled={(!input.trim() && pending.length === 0) || uploading}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
              >
                {t("send")}
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
