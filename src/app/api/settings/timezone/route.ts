import { getTimezone, setTimezone } from "@/lib/timezone";

export const dynamic = "force-dynamic";

function isValidTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export async function GET() {
  return Response.json({ timezone: getTimezone() });
}

export async function POST(req: Request) {
  let body: { timezone?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  const timezone = body.timezone?.trim();
  if (!timezone || !isValidTimezone(timezone)) {
    return Response.json({ error: "invalid_timezone" }, { status: 400 });
  }
  setTimezone(timezone);
  return Response.json({ timezone });
}
