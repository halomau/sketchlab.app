import LZString from "lz-string";
import { uid } from "../util";
import {
  generatedGraphToBoard,
  parseGeneratedGraph,
  type GeneratedGraph,
} from "../state/generatedGraph";
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

/** Compress a GeneratedGraph for `?g=` share links (agents / Claude skill). */
export function encodeGeneratedGraph(graph: GeneratedGraph): string {
  return LZString.compressToEncodedURIComponent(JSON.stringify(graph));
}

/**
 * Import a diagram from a `?g=` query value.
 * Accepts either URL-encoded GeneratedGraph JSON (starts with `{` after decode)
 * or an LZ-string payload from {@link encodeGeneratedGraph}.
 */
export function decodeGeneratedGraphParam(code: string): Board | null {
  if (!code) return null;

  // Prefer raw / URI-encoded JSON so agents can build links without lz-string.
  try {
    let text = code.trim();
    if (!text.startsWith("{")) {
      try {
        text = decodeURIComponent(text).trim();
      } catch {
        // Not URI-encoded; fall through to LZ decompress.
      }
    }
    if (text.startsWith("{")) {
      const graph = parseGeneratedGraph(JSON.parse(text));
      return generatedGraphToBoard(graph, "Imported diagram");
    }
  } catch {
    // Fall through to LZ path.
  }

  try {
    const json = LZString.decompressFromEncodedURIComponent(code);
    if (!json) return null;
    const graph = parseGeneratedGraph(JSON.parse(json));
    return generatedGraphToBoard(graph, "Imported diagram");
  } catch {
    return null;
  }
}

export function shareUrl(board: Board): string {
  const base = location.origin + location.pathname;
  return `${base}?b=${encodeBoard(board)}`;
}

/** Openable URL that hydrates a board from a GeneratedGraph (skill / agent share path). */
export function generatedGraphShareUrl(graph: GeneratedGraph, origin = location.origin + location.pathname): string {
  return `${origin}?g=${encodeURIComponent(JSON.stringify(graph))}`;
}
