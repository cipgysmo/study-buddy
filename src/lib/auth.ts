import { createHash, timingSafeEqual } from "node:crypto";
import { appPassword } from "./env";

/**
 * Single-user LAN password gate. When APP_PASSWORD is unset, auth is disabled
 * and every request passes. When set, a valid login sets an httpOnly cookie
 * whose value is a salted SHA-256 of the password; the proxy verifies it.
 */

export const AUTH_COOKIE = "study_buddy_auth";
export const AUTH_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const SALT = "study-buddy-auth-v1";

function tokenFor(secret: string): Buffer {
  return createHash("sha256").update(`${secret}:${SALT}`).digest();
}

export function authEnabled(): boolean {
  return appPassword().length > 0;
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** True when auth is off, or the cookie matches the expected token. */
export function isAuthed(token: string | undefined): boolean {
  if (!authEnabled()) return true;
  if (!token) return false;
  return safeEqual(token, tokenFor(appPassword()).toString("hex"));
}

/** Verify a submitted password against APP_PASSWORD. */
export function checkPassword(pw: string): boolean {
  const p = appPassword();
  if (!p) return false;
  return safeEqual(tokenFor(pw).toString("hex"), tokenFor(p).toString("hex"));
}

/** Cookie value to set for a correct password. */
export function authCookieValue(pw: string): string {
  return tokenFor(pw).toString("hex");
}
