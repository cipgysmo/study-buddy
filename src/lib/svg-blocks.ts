export interface ContentPart {
  text: string;
  svg: string | null;
}

/**
 * Split a chat message into text and ```svg fenced blocks, in order.
 * A block's svg is the raw markup between the fences (trimmed).
 */
export function splitSvgBlocks(content: string): ContentPart[] {
  const parts: ContentPart[] = [];
  const re = /```svg\r?\n([\s\S]*?)```/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    if (m.index > last) parts.push({ text: content.slice(last, m.index), svg: null });
    const svg = m[1].trim();
    if (svg) parts.push({ text: "", svg });
    last = m.index + m[0].length;
  }
  if (last < content.length) parts.push({ text: content.slice(last), svg: null });
  return parts.length > 0 ? parts : [{ text: content, svg: null }];
}
