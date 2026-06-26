// Lightweight, localStorage-backed input preferences. Read synchronously at
// gesture time (no store subscription needed) so the wheel handler stays cheap.

const WHEEL_ZOOM_KEY = "sketchlab:wheel-zoom";

function readBool(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false; // private mode / disabled storage — fall back to the default
  }
}

function writeBool(key: string, on: boolean): void {
  try {
    localStorage.setItem(key, on ? "1" : "0");
  } catch {
    /* ignore — preference just won't persist across reloads */
  }
}

// Default OFF: a plain scroll pans (the trackpad-first default). Mouse users opt
// in via Controls → "Scroll wheel zooms", after which a wheel notch zooms instead.
let wheelZoom = readBool(WHEEL_ZOOM_KEY);

/** True when a plain (unmodified) wheel notch should zoom-to-cursor instead of pan. */
export function getWheelZoom(): boolean {
  return wheelZoom;
}

export function setWheelZoom(on: boolean): void {
  wheelZoom = on;
  writeBool(WHEEL_ZOOM_KEY, on);
}
