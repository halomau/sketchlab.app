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

import { createEdge, createShape, loadBoard } from "../src/state/actions";
import { copySelection, pasteClipboard } from "../src/state/clipboard";
import { $activeLayer, doc, setSelection } from "../src/state/store";
import type { Board } from "../src/state/types";

function emptyBoard(): Board {
  return { name: "t", shapes: {}, edges: {}, order: [] };
}

beforeEach(() => {
  loadBoard(emptyBoard());
  $activeLayer.set(0);
});

describe("pasteClipboard layer rebase", () => {
  it("includes anchored-edge layers in minLayer so relative floors stay aligned", () => {
    // Shapes live on floor 1; the spanning edge still carries layer 0 (as can
    // happen when an edge was created earlier). Pasting onto floor 2 must shift
    // both by the same delta so the edge does not land a floor below its ends.
    const a = createShape("rect", 0, 0, 80, 80, { layer: 1 });
    const b = createShape("rect", 200, 0, 80, 80, { layer: 1 });
    const edge = createEdge(a.id, b.id)!;
    edge.layer = 0;

    setSelection([a.id, b.id], [edge.id]);
    copySelection();

    $activeLayer.set(2);
    pasteClipboard();

    const pastedShapes = Object.values(doc.board.shapes).filter(
      (s) => s.id !== a.id && s.id !== b.id,
    );
    const pastedEdges = Object.values(doc.board.edges).filter((e) => e.id !== edge.id);

    expect(pastedShapes).toHaveLength(2);
    expect(pastedEdges).toHaveLength(1);
    // minLayer was 0 (from the anchored edge), so layerDelta = 2 - 0 = 2
    expect(pastedShapes.every((s) => s.layer === 3)).toBe(true);
    expect(pastedEdges[0].layer).toBe(2);
    // edge stays the same relative offset below its endpoint floors
    expect(pastedShapes[0].layer! - pastedEdges[0].layer!).toBe(1);
  });
});
