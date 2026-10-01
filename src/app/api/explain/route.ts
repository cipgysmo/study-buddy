import { LANGUAGES } from "@/i18n/languages";
import { resolveLocale } from "@/lib/locale";
import { chat } from "@/lib/llm";
import { getStudentName } from "@/lib/profile";

export const dynamic = "force-dynamic";

/** One-shot Socratic explanation of a single question. */
export async function POST(req: Request) {
  let body: {
    prompt?: string;
    options?: string[];
    answer?: string;
    explanation?: string;
  } = {};
  try {
    body = await req.json();
  } catch {
    /* ignore */
  }
  const prompt = body.prompt?.trim();
  if (!prompt) return Response.json({ error: "prompt_required" }, { status: 400 });

  const locale = await resolveLocale();
  const languageName = LANGUAGES.find((l) => l.code === locale)?.name ?? locale;

  const hasOptions = Array.isArray(body.options) && body.options.length > 0;
  const name = getStudentName();
  const parts = [
    `You are a patient, encouraging tutor. Explain the following question step by step for a student around 13 years old. Respond in ${languageName}.`,
    ...(name ? [`The student's name is ${name}. Address them by name warmly.`] : []),
    `Question: ${prompt}`,
  ];
  if (hasOptions) {
    parts.push(`Options:\n${(body.options as string[]).map((o, i) => `${i + 1}. ${o}`).join("\n")}`);
  }
  if (body.answer?.trim()) {
    parts.push(
      `The correct answer is: ${body.answer.trim()}. Explain why it is correct${
        hasOptions ? " and why the other options are wrong" : ""
      }.`
    );
  }
  if (body.explanation?.trim()) {
    parts.push(`Additional context: ${body.explanation.trim()}`);
  }
  parts.push("Keep it clear and concise.");

  const explanation = await chat({
    messages: [{ role: "user", content: parts.join("\n\n") }],
    temperature: 0.4,
  });

  return Response.json({ explanation });
}
