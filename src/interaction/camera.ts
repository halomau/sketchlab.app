import { scene } from "../render/scene";
import { $camera, doc } from "../state/store";
import { clamp } from "../util";

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 6;

export function setCamera(x: number, y: number, zoom: number): void {
  $camera.set({ x, y, zoom: clamp(zoom, MIN_ZOOM, MAX_ZOOM) });
  scene.applyCamera();
}

export function panBy(dx: number, dy: number): void {
  const c = $camera.get();
  setCamera(c.x + dx, c.y + dy, c.zoom);
}

export function zoomAt(sx: number, sy: number, factor: number): void {
  const c = $camera.get();
  const nz = clamp(c.zoom * factor, MIN_ZOOM, MAX_ZOOM);
  const wx = (sx - c.x) / c.zoom;
  const wy = (sy - c.y) / c.zoom;
  setCamera(sx - wx * nz, sy - wy * nz, nz);
}

export function zoomBy(factor: number): void {
  const { w, h } = scene.screenSize();
  zoomAt(w / 2, h / 2, factor);
}

export function getZoom(): number {
  return $camera.get().zoom;
}

function contentBounds(): { x: number; y: number; w: number; h: number } | null {
  const shapes = Object.values(doc.board.shapes);
  if (shapes.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const s of shapes) {
    minX = Math.min(minX, s.x);
    minY = Math.min(minY, s.y);
    maxX = Math.max(maxX, s.x + s.w);
    maxY = Math.max(maxY, s.y + s.h);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export function fitToContent(): void {
  const { w, h } = scene.screenSize();
  const b = contentBounds();
  if (!b) {
    // empty board: center world origin
    setCamera(w / 2, h / 2, 1);
    return;
  }
  const pad = 0.85;
  const zoom = clamp(Math.min(w / b.w, h / b.h) * pad, MIN_ZOOM, MAX_ZOOM);
  const cx = w / 2 - (b.x + b.w / 2) * zoom;
  const cy = h / 2 - (b.y + b.h / 2) * zoom;
  setCamera(cx, cy, zoom);
}

/** Center the viewport on world origin at 100%. */
export function centerOrigin(): void {
  const { w, h } = scene.screenSize();
  setCamera(w / 2, h / 2, 1);
}
