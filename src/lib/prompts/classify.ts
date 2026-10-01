export interface ExtractResult {
  topics: string[];
}

/**
 * Prompt to derive the main topics a study document covers. The model returns
 * short canonical topic names. When the subject already has topics they are
 * passed in so the model reuses their exact names (keeping the topic list
 * consistent) while still being able to introduce genuinely new ones.
 */
export function extractTopicsPrompt(opts: {
  text: string;
  existingTopics?: string[];
  language: string;
}): string {
  const lines = [
    "/no_think",
    `Respond in ${opts.language}.`,
    "You organize study notes into topics. Read the document and list the main topics or concepts it covers.",
    "Rules:",
    "- Return between 1 and 5 topics.",
    `- Each topic is a short, canonical name (1-4 words) in ${opts.language}, like a chapter or unit title.`,
    "- Be specific; never use vague names like 'miscellaneous', 'other', or 'general'.",
    "- Only include topics the document actually covers.",
  ];
  if (opts.existingTopics && opts.existingTopics.length > 0) {
    lines.push(
      `- If one of these existing topics fits, reuse its exact name: ${opts.existingTopics.join(", ")}.`
    );
  }
  lines.push(
    'Return ONLY a JSON object: {"topics": [string]}.',
    "",
    "<document>",
    opts.text,
    "</document>"
  );
  return lines.join("\n");
}
