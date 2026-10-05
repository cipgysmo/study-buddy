import OpenAI from "openai";
import {
  llmApiKey,
  llmBaseUrl,
  llmBusyTimeoutMs,
  llmMaxConcurrency,
  llmModel,
} from "./env";
import { extractJSON } from "./json";

let _client: OpenAI | null = null;

function client(): OpenAI {
  if (!_client) {
    _client = new OpenAI({
      baseURL: llmBaseUrl(),
      apiKey: llmApiKey(),
      maxRetries: 0,
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
  /** Abort the upstream request (e.g. when the client disconnects). */
  signal?: AbortSignal;
}

// --- busy/queue handling ----------------------------------------------------
// llama-swap can reject requests when the local model is already busy. Instead
// of surfacing that immediately, queue requests in-process and retry busy-ish
// failures until a deadline (default 5 minutes).

let activeLlmRequests = 0;
const llmWaiters: (() => void)[] = [];

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new Error("aborted"));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(signal?.reason ?? new Error("aborted"));
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

async function acquireLlmSlot(signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) throw signal.reason ?? new Error("aborted");
  if (activeLlmRequests < llmMaxConcurrency()) {
    activeLlmRequests++;
    return;
  }
  return new Promise<void>((resolve, reject) => {
    function release() {
      signal?.removeEventListener("abort", onAbort);
      activeLlmRequests++;
      resolve();
    }
    function onAbort() {
      const index = llmWaiters.indexOf(release);
      if (index >= 0) llmWaiters.splice(index, 1);
      reject(signal?.reason ?? new Error("aborted"));
    }
    llmWaiters.push(release);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function releaseLlmSlot(): void {
  const next = llmWaiters.shift();
  if (next) {
    next();
    return;
  }
  activeLlmRequests = Math.max(0, activeLlmRequests - 1);
}

export function isRetryableLlmError(err: unknown): boolean {
  if (err instanceof OpenAI.APIConnectionError) return true;

  if (err instanceof OpenAI.APIError) {
    const status = err.status;
    if (status === 429 || status === 500 || status === 502 || status === 503 || status === 504) {
      return true;
    }
  }

  const message = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return [
    "busy",
    "overloaded",
    "too many requests",
    "queue",
    "queued",
    "unavailable",
    "temporarily",
    "econnrefused",
    "econnreset",
    "socket hang up",
    "network",
    "fetch failed",
    "timeout",
  ].some((needle) => message.includes(needle));
}

function retryDelayMs(attempt: number, remainingMs: number): number {
  const base = Math.min(15000, 1000 * 2 ** attempt);
  const jitter = Math.floor(Math.random() * 500);
  return Math.max(0, Math.min(base + jitter, remainingMs));
}

export async function withLlmCall<T>(fn: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  const deadline = Date.now() + llmBusyTimeoutMs();
  let attempt = 0;

  for (;;) {
    if (signal?.aborted) throw signal.reason ?? new Error("aborted");
    await acquireLlmSlot(signal);
    try {
      return await fn();
    } catch (err) {
      if (signal?.aborted) throw err;
      const remaining = deadline - Date.now();
      if (!isRetryableLlmError(err) || remaining <= 0) throw err;
      await sleep(retryDelayMs(attempt, remaining), signal);
      attempt++;
    } finally {
      releaseLlmSlot();
    }
  }
}

/** Non-streaming completion. Returns the raw assistant text. */
export async function chat(opts: ChatOptions): Promise<string> {
  const res = await withLlmCall(
    () =>
      client().chat.completions.create({
        model: llmModel(),
        messages: opts.messages,
        temperature: opts.temperature ?? 0.4,
        ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
        ...(opts.json ? { response_format: { type: "json_object" as const } } : {}),
        ...(opts.signal ? { signal: opts.signal } : {}),
      }),
    opts.signal
  );
  return res.choices[0]?.message?.content ?? "";
}

/** Streaming completion. Yields text deltas as they arrive. */
export async function* chatStream(opts: ChatOptions): AsyncGenerator<string> {
  const deadline = Date.now() + llmBusyTimeoutMs();
  let attempt = 0;

  for (;;) {
    if (opts.signal?.aborted) throw opts.signal.reason ?? new Error("aborted");
    await acquireLlmSlot(opts.signal);

    let stream: Awaited<ReturnType<OpenAI["chat"]["completions"]["create"]>>;
    try {
      stream = await client().chat.completions.create({
        model: llmModel(),
        messages: opts.messages,
        temperature: opts.temperature ?? 0.4,
        ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
        stream: true,
        ...(opts.signal ? { signal: opts.signal } : {}),
      });
    } catch (err) {
      releaseLlmSlot();
      if (opts.signal?.aborted) throw err;
      const remaining = deadline - Date.now();
      if (!isRetryableLlmError(err) || remaining <= 0) throw err;
      await sleep(retryDelayMs(attempt, remaining), opts.signal);
      attempt++;
      continue;
    }

    let yielded = false;
    let retry = false;
    try {
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          yielded = true;
          yield delta;
        }
      }
      return;
    } catch (err) {
      const remaining = deadline - Date.now();
      if (!opts.signal?.aborted && !yielded && isRetryableLlmError(err) && remaining > 0) {
        retry = true;
      } else {
        throw err;
      }
    } finally {
      releaseLlmSlot();
    }

    if (retry) {
      await sleep(retryDelayMs(attempt, deadline - Date.now()), opts.signal);
      attempt++;
    }
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
  const res = await withLlmCall(() =>
    client().chat.completions.create({
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
    })
  );
  return res.choices[0]?.message?.content ?? "";
}