"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

interface Session {
  id: string;
  title: string;
  subject_id: string | null;
}
interface Subject {
  id: string;
  name: string;
}
interface Msg {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const TMP_USER = "tmp-user";
const TMP_ASST = "tmp-asst";

export function ChatApp({
  initialSessions,
  subjects,
}: {
  initialSessions: Session[];
  subjects: Subject[];
}) {
  const t = useTranslations("Chat");
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>(initialSessions);
  const [activeId, setActiveId] = useState<string | null>(initialSessions[0]?.id ?? null);
  const [subjectId, setSubjectId] = useState<string>("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

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

  async function send() {
    const content = input.trim();
    if (!content || streaming) return;

    let sessionId = activeId;
    if (!sessionId) sessionId = await createSession();
    setActiveId(sessionId);

    setInput("");
    setMessages((prev) => [
      ...prev,
      { id: TMP_USER, role: "user", content },
      { id: TMP_ASST, role: "assistant", content: "" },
    ]);
    setStreaming(true);

    try {
      const res = await fetch(`/api/chat/sessions/${sessionId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, subjectId: subjectId || null }),
      });
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
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
      setMessages((prev) =>
        prev.map((m) =>
          m.id === TMP_ASST
            ? { ...m, content: `${m.content}\n\n[${t("error")}] ${String(e)}` }
            : m
        )
      );
    } finally {
      setStreaming(false);
      router.refresh();
    }
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
          <button
            key={s.id}
            onClick={() => setActiveId(s.id)}
            className={
              "block w-full truncate rounded-lg px-3 py-2 text-left text-sm " +
              (s.id === activeId
                ? "bg-foreground/10 font-medium"
                : "text-muted hover:bg-foreground/5")
            }
          >
            {s.title}
          </button>
        ))}
      </aside>

      <section className="flex min-w-0 flex-1 flex-col rounded-2xl border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border px-4 py-2">
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className="rounded-lg border border-border bg-background px-2 py-1 text-sm"
          >
            <option value="">{t("noSubject")}</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.length === 0 && (
            <p className="text-sm text-muted">{t("empty")}</p>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              className={
                "max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm " +
                (m.role === "user"
                  ? "ml-auto bg-accent text-accent-foreground"
                  : "bg-foreground/5")
              }
            >
              {m.content}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="flex gap-2 border-t border-border p-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={t("placeholder")}
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <button
            onClick={send}
            disabled={streaming || !input.trim()}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
          >
            {t("send")}
          </button>
        </div>
      </section>
    </div>
  );
}
