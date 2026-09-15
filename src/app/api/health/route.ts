import { llmModel } from "@/lib/env";
import { listModels } from "@/lib/llm";

export const dynamic = "force-dynamic";

export async function GET() {
  let llm: "ok" | "error" = "ok";
  let models: string[] = [];
  let error: string | undefined;

  try {
    models = await listModels();
  } catch (e) {
    llm = "error";
    error = e instanceof Error ? e.message : String(e);
  }

  return Response.json({
    status: llm === "ok" ? "ok" : "degraded",
    llm,
    model: llmModel(),
    models,
    error,
    time: new Date().toISOString(),
  });
}
