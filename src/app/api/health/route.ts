import { llmModel } from "@/lib/llm-settings";
import { listModels } from "@/lib/llm";

export const dynamic = "force-dynamic";

export async function GET() {
  let llm: "ok" | "error" = "ok";
  let models: string[] = [];

  try {
    models = await listModels();
  } catch {
    llm = "error";
    // Do not surface the upstream error (it can leak internal host/IP).
  }

  return Response.json({
    status: llm === "ok" ? "ok" : "degraded",
    llm,
    model: llmModel(),
    models,
    time: new Date().toISOString(),
  });
}
