import { atom } from "nanostores";
import { uid } from "../util";
import type { Board, Camera, SelectionState, ToolName } from "./types";

export function emptyBoard(name = "Untitled"): Board {
  const now = Date.now();
  return {
    id: uid(),
    name,
    shapes: {},
    edges: {},
    order: [],
    createdAt: now,
    updatedAt: now,
  };
}

/** The active board document. Mutated in place by actions for performance. */
export const doc: { board: Board } = { board: emptyBoard() };

export const $tool = atom<ToolName>("select");
export const $camera = atom<Camera>({ x: 0, y: 0, zoom: 1 });
export const $selection = atom<SelectionState>({
  shapes: new Set(),
  edges: new Set(),
});
/** Bumped on every document mutation; autosave listens to this. */
export const $revision = atom(0);
export const $boardName = atom("Untitled");
/** Style applied to newly created shapes / the current edit target. */
export const $style = atom<{ fill: string; stroke: string }>({
  fill: "#0f2740",
  stroke: "#38bdf8",
});
/** Transient hint text shown in the status bar. */
export const $status = atom("");

export function bumpRevision(): void {
  $revision.set($revision.get() + 1);
}

export function setSelection(shapes: Iterable<string>, edges: Iterable<string>): void {
  $selection.set({ shapes: new Set(shapes), edges: new Set(edges) });
}

export function clearSelection(): void {
  const cur = $selection.get();
  if (cur.shapes.size === 0 && cur.edges.size === 0) return;
  setSelection([], []);
}

export function isSelected(id: string): boolean {
  const s = $selection.get();
  return s.shapes.has(id) || s.edges.has(id);
}
