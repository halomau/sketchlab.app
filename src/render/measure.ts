const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

let ctx: CanvasRenderingContext2D | null = null;
function context(): CanvasRenderingContext2D | null {
  if (!ctx) ctx = document.createElement("canvas").getContext("2d");
  return ctx;
}

export const TEXT_FONT_SIZE = 20;
export const TEXT_PAD = 10;
const LINE_RATIO = 1.3;

/** Box size that fits a text object's content (so the object auto-grows). */
export function measureTextBox(text: string, fontSize = TEXT_FONT_SIZE): { w: number; h: number } {
  const c = context();
  const lines = (text.length ? text : " ").split("\n");
  let maxW = 0;
  if (c) {
    c.font = `600 ${fontSize}px ${FONT}`;
    for (const ln of lines) maxW = Math.max(maxW, c.measureText(ln || " ").width);
  } else {
    for (const ln of lines) maxW = Math.max(maxW, (ln || " ").length * fontSize * 0.55);
  }
  const lineH = fontSize * LINE_RATIO;
  return {
    w: Math.ceil(maxW) + TEXT_PAD * 2,
    h: Math.ceil(lines.length * lineH) + TEXT_PAD * 2,
  };
}
