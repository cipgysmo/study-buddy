import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const dir = mkdtempSync(path.join(tmpdir(), "sb-chat-"));
process.env.DATA_DIR = dir;

import { getDb } from "@/lib/db";
import { addMessage, createSession, listMessages, listSessions } from "@/lib/chat";

beforeAll(() => {
  getDb().prepare("INSERT INTO subjects (id, name) VALUES (?, ?)").run("subj-1", "Math");
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("chat sessions", () => {
  it("sets updated_at on creation", () => {
    const s = createSession("subj-1");
    expect(s.updated_at).toBeTruthy();
  });

  it("orders sessions by recency and bubbles one up when a message is added", () => {
    const db = getDb();
    const a = createSession("subj-1", "A");
    const b = createSession("subj-1", "B");
    const order = () => listSessions().map((s) => s.id);
    // Force A to look old, so B is more recent than A.
    db.prepare("UPDATE chat_sessions SET updated_at = '2000-01-01 00:00:00' WHERE id = ?").run(a.id);
    expect(order().indexOf(b.id)).toBeLessThan(order().indexOf(a.id));

    addMessage(a.id, "user", "hello");
    expect(order().indexOf(a.id)).toBeLessThan(order().indexOf(b.id));
  });

  it("returns messages in insertion order", () => {
    const s = createSession("subj-1", "Thread");
    addMessage(s.id, "user", "one");
    addMessage(s.id, "assistant", "two");
    addMessage(s.id, "user", "three");
    const msgs = listMessages(s.id);
    expect(msgs.map((m) => m.content)).toEqual(["one", "two", "three"]);
    expect(msgs.every((m) => m.session_id === s.id)).toBe(true);
  });
});
