/**
 * Instruction appended to generator prompts so the model can attach a
 * geometric figure (or any helpful diagram) to a question as standalone SVG.
 * Rendered client-side in a sandboxed iframe; currentColor keeps it
 * theme-aware.
 */
export const DIAGRAM_INSTRUCTION =
  'Only add a "diagram" field when you can draw a clean, useful, standalone SVG with simple primitives. Good diagrams: geometric figures, simple function graphs with axes, simple charts, and simple schematics. Bad diagrams: anything where proportions, labels, or layout would be approximate or misleading. If you are not confident, omit the diagram. SVG contract: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">; use stroke="currentColor" fill="none" for lines/shapes and fill="currentColor" font-size="14" for labels; no HTML, no foreignObject, no style/script, no external images. For graphs: draw axes, tick marks, and the curve as a path; label axes clearly. Keep it under about 30 drawing elements and 12 labels. Show ONLY the information given in the question — never include the answer, the solution, or the value the question asks to find inside the diagram. Omit the field when no figure is needed.';
