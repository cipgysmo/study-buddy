/**
 * Instruction appended to generator prompts so the model can attach a
 * geometric figure (or any helpful diagram) to a question as standalone SVG.
 * Rendered client-side in a sandboxed iframe; currentColor keeps it
 * theme-aware.
 */
export const DIAGRAM_INSTRUCTION =
  'If a question involves a geometric figure or any diagram that would help the student, add a "diagram" field containing a complete standalone SVG: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"> using stroke="currentColor" fill="none" for shapes and fill="currentColor" font-size="14" for text labels. Keep figures simple and geometrically accurate (correct angles, labels at the right places). Show ONLY the information given in the question — never include the answer, the solution, or the value the question asks to find inside the diagram. Omit the field when no figure is needed.';
