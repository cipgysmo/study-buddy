import { randomUUID } from "node:crypto";
import { getDb } from "./db";

export interface ChatSession {
  id: string;
  subject_id: string | null;
  title: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
}

export function listSessions(): ChatSession[] {
  return getDb()
    .prepare("SELECT * FROM chat_sessions ORDER BY created_at DESC")
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
    .prepare("INSERT INTO chat_sessions (id, subject_id, title) VALUES (?, ?, ?)")
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
  return getDb()
    .prepare("SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC, rowid ASC")
    .all(sessionId) as ChatMessage[];
}

export function addMessage(
  sessionId: string,
  role: ChatMessage["role"],
  content: string
): ChatMessage {
  const id = randomUUID();
  getDb()
    .prepare("INSERT INTO chat_messages (id, session_id, role, content) VALUES (?, ?, ?, ?)")
    .run(id, sessionId, role, content);
  return getDb().prepare("SELECT * FROM chat_messages WHERE id = ?").get(id) as ChatMessage;
}
