import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, authEnabled, isAuthed } from "@/lib/auth";

// Proxy always runs on the Node.js runtime, so runtime env vars and node:crypto work.
export default function proxy(req: NextRequest) {
  if (!authEnabled()) return NextResponse.next();

  const token = req.cookies.get(AUTH_COOKIE)?.value;
  if (isAuthed(token)) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = "";
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Protect everything except the login page/route, health checks, and static assets.
  matcher: [
    "/((?!login|api/login|api/health|_next/static|_next/image|favicon.ico|icon.jpg|.*\\.(?:png|jpg|jpeg|svg|ico|css|js|woff2?)$).*)",
  ],
};
