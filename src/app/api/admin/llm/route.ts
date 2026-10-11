import { getLlmSettings, updateLlmSettings } from "@/lib/llm-settings";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ settings: getLlmSettings() });
}

export async function POST(req: Request) {
  let body: {
    languageEnabled?: boolean;
    baseUrl?: string;
    model?: string;
    apiKey?: string;
    clearApiKey?: boolean;
    visionEnabled?: boolean;
    visionBaseUrl?: string;
    visionModel?: string;
    visionApiKey?: string;
    clearVisionApiKey?: boolean;
  } = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  updateLlmSettings(body);
  return Response.json({ settings: getLlmSettings() });
}
