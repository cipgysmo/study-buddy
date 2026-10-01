import { getSetting, setSetting } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ sound: getSetting("sound") ?? "on" });
}

export async function POST(req: Request) {
  let body: { sound?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* ignore */
  }
  if (body.sound !== "on" && body.sound !== "off") {
    return Response.json({ error: "invalid_sound" }, { status: 400 });
  }
  setSetting("sound", body.sound);
  return Response.json({ ok: true });
}
