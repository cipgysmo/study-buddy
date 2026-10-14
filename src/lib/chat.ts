import { randomUUID } from "node:crypto";
import { getDb } from "./db";

export interface ChatSession {
  id: string;
  subject_id: string | null;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatAttachmentMeta {
  id: string;
  kind: "image" | "pdf";
  name: string;
  mime: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  attachments: ChatAttachmentMeta[] | null;
  created_at: string;
}

function parseAttachments(raw: unknown): ChatAttachmentMeta[] | null {
  if (typeof raw !== "string" || !raw) return null;
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) && arr.length ? (arr as ChatAttachmentMeta[]) : null;
  } catch {
    return null;
  }
}

function hydrate(row: Record<string, unknown>): ChatMessage {
  return { ...(row as Omit<ChatMessage, "attachments">), attachments: parseAttachments(row.attachments) };
}

export function listSessions(): ChatSession[] {
  return getDb()
    .prepare(
      "SELECT * FROM chat_sessions ORDER BY COALESCE(updated_at, created_at) DESC, created_at DESC"
    )
    .all() as ChatSession[];
}

export function getSession(id: string): ChatSession | null {
  const row = getDb()
    .prepare("SELECT * FROM chat_sessions WHERE id = ?")
    .get(id) as ChatSession | undefined;
  return row ?? null;
}

export function createSession(subjectId: string | null, title?: string): ChatSession {
  const id = randomUUID();
  getDb()
    .prepare(
      "INSERT INTO chat_sessions (id, subject_id, title, updated_at) VALUES (?, ?, ?, datetime('now'))"
    )
    .run(id, subjectId, title?.trim() || "New chat");
  return getSession(id)!;
}

export function deleteSession(id: string): void {
  getDb().prepare("DELETE FROM chat_sessions WHERE id = ?").run(id);
}

export function setSessionSubject(sessionId: string, subjectId: string | null): void {
  getDb().prepare("UPDATE chat_sessions SET subject_id = ? WHERE id = ?").run(subjectId, sessionId);
}

export function setSessionTitle(sessionId: string, title: string): void {
  getDb().prepare("UPDATE chat_sessions SET title = ? WHERE id = ?").run(title, sessionId);
}

export function listMessages(sessionId: string): ChatMessage[] {
  const rows = getDb()
    .prepare("SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC, rowid ASC")
    .all(sessionId) as Record<string, unknown>[];
  return rows.map(hydrate);
}

export function addMessage(
  sessionId: string,
  role: ChatMessage["role"],
  content: string,
  attachments?: ChatAttachmentMeta[]
): ChatMessage {
  const id = randomUUID();
  const db = getDb();
  db.prepare(
    "INSERT INTO chat_messages (id, session_id, role, content, attachments) VALUES (?, ?, ?, ?, ?)"
  ).run(id, sessionId, role, content, attachments?.length ? JSON.stringify(attachments) : null);
  db.prepare("UPDATE chat_sessions SET updated_at = datetime('now') WHERE id = ?").run(sessionId);
  return hydrate(
    db.prepare("SELECT * FROM chat_messages WHERE id = ?").get(id) as Record<string, unknown>
  );
}

export interface ChatAttachmentRow {
  id: string;
  session_id: string;
  kind: "image" | "pdf";
  name: string;
  mime: string;
  path: string;
  created_at: string;
}

export function createAttachment(
  sessionId: string,
  kind: "image" | "pdf",
  name: string,
  mime: string,
  filePath: string
): ChatAttachmentRow {
  const id = randomUUID();
  getDb()
    .prepare(
      "INSERT INTO chat_attachments (id, session_id, kind, name, mime, path) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .run(id, sessionId, kind, name, mime, filePath);
  return getAttachment(id)!;
}

export function getAttachment(id: string): ChatAttachmentRow | null {
  const row = getDb().prepare("SELECT * FROM chat_attachments WHERE id = ?").get(id) as
    | ChatAttachmentRow
    | undefined;
  return row ?? null;
}
