import { isSupportedTheme, setTheme, type Theme } from "@/lib/theme";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { theme?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* ignore */
  }
  if (!isSupportedTheme(body.theme ?? "")) {
    return Response.json({ error: "invalid_theme" }, { status: 400 });
  }
  await setTheme(body.theme as Theme);
  return Response.json({ ok: true });
}
