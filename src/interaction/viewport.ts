import { $camera } from "../state/store";
import type { Pt } from "../render/geometry";

/** Canvas-local screen px -> world coords. */
export function screenToWorld(sx: number, sy: number): Pt {
  const c = $camera.get();
  return { x: (sx - c.x) / c.zoom, y: (sy - c.y) / c.zoom };
}

/** World coords -> canvas-local screen px. */
export function worldToScreen(wx: number, wy: number): Pt {
  const c = $camera.get();
  return { x: wx * c.zoom + c.x, y: wy * c.zoom + c.y };
}
