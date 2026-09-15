import OpenAI from "openai";
import { llmApiKey, llmBaseUrl, llmModel } from "./env";
import { extractJSON } from "./json";

let _client: OpenAI | null = null;

function client(): OpenAI {
  if (!_client) {
    _client = new OpenAI({
      baseURL: llmBaseUrl(),
      apiKey: llmApiKey(),
    });
  }
  return _client;
}

export type ChatMessage = OpenAI.Chat.ChatCompletionMessageParam;

export interface ChatOptions {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  /** Request a strict JSON object response (used by chatJSON). */
  json?: boolean;
}

/** Non-streaming completion. Returns the raw assistant text. */
export async function chat(opts: ChatOptions): Promise<string> {
  const res = await client().chat.completions.create({
    model: llmModel(),
    messages: opts.messages,
    temperature: opts.temperature ?? 0.4,
    ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
    ...(opts.json ? { response_format: { type: "json_object" as const } } : {}),
  });
  return res.choices[0]?.message?.content ?? "";
}

/** Streaming completion. Yields text deltas as they arrive. */
export async function* chatStream(opts: ChatOptions): AsyncGenerator<string> {
  const stream = await client().chat.completions.create({
    model: llmModel(),
    messages: opts.messages,
    temperature: opts.temperature ?? 0.4,
    ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
    stream: true,
  });
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) yield delta;
  }
}

/** Non-streaming completion that must return a JSON object, parsed defensively. */
export async function chatJSON<T>(opts: ChatOptions): Promise<T> {
  const text = await chat({ ...opts, json: true });
  return extractJSON<T>(text);
}

/** Lightweight connectivity check against the router. */
export async function listModels(): Promise<string[]> {
  const res = await client().models.list();
  return res.data.map((m) => m.id);
}

export interface VisionOptions {
  imageBase64: string;
  mimeType: string;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
}

/** Non-streaming completion with an inline image (vision / OCR). */
export async function chatVision(opts: VisionOptions): Promise<string> {
  const res = await client().chat.completions.create({
    model: llmModel(),
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: opts.prompt },
          {
            type: "image_url",
            image_url: { url: `data:${opts.mimeType};base64,${opts.imageBase64}` },
          },
        ],
      },
    ],
    temperature: opts.temperature ?? 0.2,
    ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
  });
  return res.choices[0]?.message?.content ?? "";
}
