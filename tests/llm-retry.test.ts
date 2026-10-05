process.env.LLM_BUSY_TIMEOUT_MS = "5000";
process.env.LLM_MAX_CONCURRENCY = "1";

import { describe, expect, it } from "vitest";
import { isRetryableLlmError, withLlmCall } from "@/lib/llm";

describe("LLM busy retry", () => {
  it("retries busy-looking failures until the call succeeds", async () => {
    let calls = 0;
    const result = await withLlmCall(async () => {
      calls++;
      if (calls < 3) throw new Error("Too Many Requests");
      return "ok";
    });
    expect(result).toBe("ok");
    expect(calls).toBe(3);
  });

  it("does not retry non-retryable failures", async () => {
    let calls = 0;
    await expect(
      withLlmCall(async () => {
        calls++;
        throw new Error("invalid_prompt");
      })
    ).rejects.toThrow("invalid_prompt");
    expect(calls).toBe(1);
  });

  it("classifies common busy statuses and messages", () => {
    const statusError = Object.assign(new Error("server busy"), { status: 503 });
    expect(isRetryableLlmError(statusError)).toBe(true);
    expect(isRetryableLlmError(new Error("model is overloaded"))).toBe(true);
    expect(isRetryableLlmError(new Error("bad request"))).toBe(false);
  });
});