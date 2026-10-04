import { cookies } from "next/headers";
import {
  AUTH_COOKIE,
  AUTH_MAX_AGE,
  authCookieValue,
  checkPassword,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { password?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* ignore */
  }
  const pw = body.password ?? "";
  if (!checkPassword(pw)) {
    return Response.json({ error: "invalid" }, { status: 401 });
  }
  const store = await cookies();
  store.set(AUTH_COOKIE, authCookieValue(pw), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: AUTH_MAX_AGE,
    secure: false, // LAN deployment over http; set true if served over https.
  });
  return Response.json({ ok: true });
}

export async function DELETE() {
  const store = await cookies();
  store.delete(AUTH_COOKIE);
  return Response.json({ ok: true });
}
