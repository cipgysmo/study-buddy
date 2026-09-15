/**
 * Defensively extract a JSON value from an LLM response.
 * Handles: raw JSON, JSON wrapped in ```json fences, and leading/trailing prose.
 */
export function extractJSON<T>(text: string): T {
  const trimmed = text.trim();

  // 1) Whole string is valid JSON.
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    /* fall through */
  }

  // 2) JSON inside a markdown code fence.
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) {
    try {
      return JSON.parse(fence[1].trim()) as T;
    } catch {
      /* fall through */
    }
  }

  // 3) Outermost balanced object or array.
  const obj = sliceBalanced(trimmed, "{", "}");
  if (obj) {
    try {
      return JSON.parse(obj) as T;
    } catch {
      /* fall through */
    }
  }
  const arr = sliceBalanced(trimmed, "[", "]");
  if (arr) {
    try {
      return JSON.parse(arr) as T;
    } catch {
      /* fall through */
    }
  }

  throw new Error(`Could not parse JSON from LLM response: ${trimmed.slice(0, 200)}`);
}

function sliceBalanced(text: string, open: string, close: string): string | null {
  const start = text.indexOf(open);
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}
