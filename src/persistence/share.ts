import LZString from "lz-string";
import { uid } from "../util";
import type { Board, Edge, ID, LayerDef, Shape } from "../state/types";

interface SharePayload {
  n: string;
  s: Record<ID, Shape>;
  e: Record<ID, Edge>;
  o: ID[];
  /** named floors (optional; absent in pre-feature share links) */
  l?: LayerDef[];
}

export function encodeBoard(board: Board): string {
  const payload: SharePayload = {
    n: board.name,
    s: board.shapes,
    e: board.edges,
    o: board.order,
    l: board.layers,
  };
  return LZString.compressToEncodedURIComponent(JSON.stringify(payload));
}

export function decodeBoard(code: string): Board | null {
  try {
    const json = LZString.decompressFromEncodedURIComponent(code);
    if (!json) return null;
    const p = JSON.parse(json) as Partial<SharePayload>;
    const shapes = p.s ?? {};
    const now = Date.now();
    return {
      id: uid(),
      name: p.n ?? "Shared board",
      shapes,
      edges: p.e ?? {},
      order: p.o ?? Object.keys(shapes),
      layers: p.l ?? [],
      createdAt: now,
      updatedAt: now,
    };
  } catch {
    return null;
  }
}

export function shareUrl(board: Board): string {
  const base = location.origin + location.pathname;
  return `${base}?b=${encodeBoard(board)}`;
}
