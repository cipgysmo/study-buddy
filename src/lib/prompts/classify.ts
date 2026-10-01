export interface ClassifyResult {
  topics: string[];
}

/**
 * Prompt to classify a study document into a subject's existing topics. The
 * model must return only topic names drawn from the provided list (or none).
 */
export function classifyTopicsPrompt(opts: { topics: string[]; text: string }): string {
  return [
    "/no_think",
    "You classify a study document into topics.",
    `Available topics: ${opts.topics.join(", ")}.`,
    "Select ONLY the topics the document actually covers. If none apply, return an empty list.",
    'Return ONLY a JSON object: {"topics": [string]}.',
    "",
    "<document>",
    opts.text,
    "</document>",
  ].join("\n");
}
