"use client";

import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Diagram } from "@/components/ui/diagram";
import { splitSvgBlocks } from "@/lib/svg-blocks";

/**
 * Renders assistant text as Markdown with math (KaTeX), and any ```svg fenced
 * blocks as sanitized inline diagrams. Shared by the tutor chat and the lesson
 * reader. Raw HTML is not rendered (react-markdown default); SVG is sanitized.
 */
export function RichText({ content, className = "" }: { content: string; className?: string }) {
  const parts = useMemo(() => splitSvgBlocks(content), [content]);
  return (
    <div className={`rich-text ${className}`}>
      {parts.map((part, i) => {
        if (part.svg) {
          return (
            <div key={i} className="my-3">
              <Diagram svg={part.svg} />
            </div>
          );
        }
        if (!part.text.trim()) return null;
        return (
          <ReactMarkdown
            key={i}
            remarkPlugins={[remarkMath]}
            rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
          >
            {part.text}
          </ReactMarkdown>
        );
      })}
    </div>
  );
}
