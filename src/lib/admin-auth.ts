import { createHash, timingSafeEqual } from "node:crypto";
import { getDb, getSetting, setSetting } from "./db";

export const ADMIN_COOKIE = "study_buddy_admin";
export const ADMIN_MAX_AGE = 60 * 60 * 12; // 12 hours
const ADMIN_PASSWORD_KEY = "admin_password_hash";
const SALT = "study-buddy-admin-v1";

function tokenFor(secret: string): string {
  return createHash("sha256").update(`${secret}:${SALT}`).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function adminPasswordEnabled(): boolean {
  return Boolean(getSetting(ADMIN_PASSWORD_KEY));
}

export function checkAdminPassword(pw: string): boolean {
  const hash = getSetting(ADMIN_PASSWORD_KEY);
  if (!hash) return false;
  return safeEqual(tokenFor(pw), hash);
}

export function setAdminPassword(pw: string): void {
  const trimmed = pw.trim();
  if (!trimmed) throw new Error("password_required");
  setSetting(ADMIN_PASSWORD_KEY, tokenFor(trimmed));
}

export function clearAdminPassword(): void {
  getDb().prepare("DELETE FROM settings WHERE key = ?").run(ADMIN_PASSWORD_KEY);
}

export function adminCookieValue(pw: string): string {
  return tokenFor(pw);
}

export function isAdminAuthed(token: string | undefined): boolean {
  if (!adminPasswordEnabled()) return true;
  if (!token) return false;
  const hash = getSetting(ADMIN_PASSWORD_KEY);
  return Boolean(hash && safeEqual(token, hash));
}
