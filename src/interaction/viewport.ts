import type { Pt } from "../render/geometry";
import {
  getActiveProjector,
  projectBoard,
  unprojectBoard,
  unprojectBoardAt,
} from "../render/projection";

/**
 * World (board ground) coords -> canvas-local screen px, through the active
 * perspective projector. May be off-screen / NaN for points behind the camera;
 * callers that draw can tolerate that, hit-testing should use screenToWorld.
 */
export function worldToScreen(wx: number, wy: number): Pt {
  const p = projectBoard(getActiveProjector(), wx, wy);
  return { x: p.sx, y: p.sy };
}

/**
 * Canvas-local screen px -> world (board ground) coords. Returns null when the
 * pointer is at/above the horizon (no ground intersection) — callers MUST guard
 * so a NaN never reaches the document.
 */
export function screenToWorld(sx: number, sy: number): Pt | null {
  const g = unprojectBoard(getActiveProjector(), sx, sy);
  return g ? { x: g.wx, y: g.wy } : null;
}

/**
 * Like screenToWorld, but resolves the point on the plane lifted to world-up
 * `height` (a raised floor) instead of the ground — so a point unprojected here
 * projects back to the same pixel when later drawn at that same height. Returns
 * null at/above the horizon; callers MUST guard.
 */
export function screenToWorldAt(sx: number, sy: number, height: number): Pt | null {
  const g = unprojectBoardAt(getActiveProjector(), sx, sy, height);
  return g ? { x: g.wx, y: g.wy } : null;
}
