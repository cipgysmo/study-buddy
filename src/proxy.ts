import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, adminPasswordEnabled, isAdminAuthed } from "@/lib/admin-auth";
import { AUTH_COOKIE, authEnabled, isAuthed } from "@/lib/auth";

// Proxy always runs on the Node.js runtime, so runtime env vars and node:crypto work.
export default function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (authEnabled()) {
    const token = req.cookies.get(AUTH_COOKIE)?.value;
    if (!isAuthed(token)) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
      }
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.search = "";
      return NextResponse.redirect(loginUrl);
    }
  }

  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");
  const isAdminApi = pathname.startsWith("/api/admin");
  const isAdminLoginRoute = pathname === "/admin/login" || pathname === "/api/admin/login";
  if ((isAdminRoute || isAdminApi) && !isAdminLoginRoute && adminPasswordEnabled()) {
    if (!isAdminAuthed(req.cookies.get(ADMIN_COOKIE)?.value)) {
      if (isAdminApi) {
        return NextResponse.json({ error: "admin_unauthorized" }, { status: 401 });
      }
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = "/admin/login";
      loginUrl.search = "";
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  // Protect everything except the login page/route, health checks, and static
  // assets. The extension exclusion is intentionally NOT applied to /api paths,
  // so a request like `DELETE /api/admin/students/x.svg` cannot bypass the gate.
  matcher: [
    "/((?!login|api/login|api/health|_next/static|_next/image|favicon.ico|icon.jpg|manifest.webmanifest|sounds/).*)",
  ],
};
