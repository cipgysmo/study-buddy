import { cookies } from "next/headers";
import {
  ADMIN_COOKIE,
  ADMIN_MAX_AGE,
  adminCookieValue,
  clearAdminPassword,
  setAdminPassword,
} from "@/lib/admin-auth";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const denied = requireAuth(req);
  if (denied) return denied;
  let body: { password?: string } = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  try {
    const password = body.password ?? "";
    setAdminPassword(password);
    const store = await cookies();
    store.set(ADMIN_COOKIE, adminCookieValue(password), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: ADMIN_MAX_AGE,
      secure: false,
    });
    return Response.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return Response.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  const denied = requireAuth(req);
  if (denied) return denied;
  clearAdminPassword();
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
  return Response.json({ ok: true });
}
