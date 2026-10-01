import { getDb, getSetting, setSetting } from "./db";

const NAME_KEY = "student_name";
const MAX_NAME = 60;

/** The student's display name, or "" if unset. */
export function getStudentName(): string {
  return (getSetting(NAME_KEY) ?? "").trim();
}

/** Persist the student's name (trimmed, length-capped). Returns the stored value. */
export function setStudentName(name: string): string {
  const trimmed = name.trim().slice(0, MAX_NAME);
  if (trimmed) {
    setSetting(NAME_KEY, trimmed);
  } else {
    getDb().prepare("DELETE FROM settings WHERE key = ?").run(NAME_KEY);
  }
  return trimmed;
}
