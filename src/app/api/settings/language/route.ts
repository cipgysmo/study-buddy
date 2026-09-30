import { isSupportedLocale } from "@/i18n/languages";
import { resolveLocale, setLocale } from "@/lib/locale";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ locale: await resolveLocale() });
}

export async function POST(req: Request) {
  let body: { locale?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body.locale || !isSupportedLocale(body.locale)) {
    return Response.json({ error: "unsupported_locale" }, { status: 400 });
  }
  await setLocale(body.locale);
  return Response.json({ locale: body.locale });
}
