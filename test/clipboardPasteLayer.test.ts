import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/render/scene", () => ({
  scene: {
    addNode: vi.fn(),
    addEdge: vi.fn(),
    updateNode: vi.fn(),
    updateEdge: vi.fn(),
    rebuild: vi.fn(),
    requestRender: vi.fn(),
  },
}));

import { createShape, loadBoard } from "../src/state/actions";
import { copySelection, pasteClipboard } from "../src/state/clipboard";
import { $activeLayer, doc, setSelection } from "../src/state/store";
import type { Board, LayerDef } from "../src/state/types";

function boardWithFloors(n: number): Board {
  const layers: LayerDef[] = Array.from({ length: n }, (_, i) => ({
    id: `L${i}`,
    name: i === 0 ? "Ground" : `Layer ${i}`,
  }));
  return { name: "t", shapes: {}, edges: {}, order: [], layers };
}

beforeEach(() => {
  loadBoard(boardWithFloors(3));
  $activeLayer.set(0);
});

describe("pasteClipboard layer rebase", () => {
  it("clamps rebased layers to layers.length - 1 (no phantom floors)", () => {
    // Copy shapes spanning floors 0 and 1, then paste onto the top floor (2).
    // Without an upper clamp, the floor-1 shape would land at index 3.
    const low = createShape("rect", 0, 0, 40, 40, { layer: 0 });
    const high = createShape("rect", 50, 0, 40, 40, { layer: 1 });
    setSelection([low.id, high.id], []);
    copySelection();

    $activeLayer.set(2);
    pasteClipboard();

    const pasted = Object.values(doc.board.shapes).filter(
      (s) => s.id !== low.id && s.id !== high.id,
    );
    expect(pasted).toHaveLength(2);
    const layers = pasted.map((s) => s.layer ?? 0).sort((a, b) => a - b);
    // Both clamp onto the top floor (2): floor0→2, floor1→3→2. No phantom index 3.
    expect(layers).toEqual([2, 2]);
    expect(Math.max(...layers)).toBeLessThanOrEqual(doc.board.layers!.length - 1);
  });

  it("still relative-rebases multi-floor content when it fits", () => {
    const low = createShape("rect", 0, 0, 40, 40, { layer: 0 });
    const high = createShape("rect", 50, 0, 40, 40, { layer: 1 });
    setSelection([low.id, high.id], []);
    copySelection();

    $activeLayer.set(1);
    pasteClipboard();

    const pasted = Object.values(doc.board.shapes).filter(
      (s) => s.id !== low.id && s.id !== high.id,
    );
    const layers = pasted.map((s) => s.layer ?? 0).sort((a, b) => a - b);
    expect(layers).toEqual([1, 2]);
  });
});
