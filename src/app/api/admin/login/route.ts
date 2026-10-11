import { cookies } from "next/headers";
import {
  ADMIN_COOKIE,
  ADMIN_MAX_AGE,
  adminCookieValue,
  adminPasswordEnabled,
  checkAdminPassword,
} from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!adminPasswordEnabled()) return Response.json({ ok: true });
  let body: { password?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* ignore */
  }
  const pw = body.password ?? "";
  if (!checkAdminPassword(pw)) {
    return Response.json({ error: "invalid" }, { status: 401 });
  }
  const store = await cookies();
  store.set(ADMIN_COOKIE, adminCookieValue(pw), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_MAX_AGE,
    secure: false,
  });
  return Response.json({ ok: true });
}

export async function DELETE() {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
  return Response.json({ ok: true });
}
