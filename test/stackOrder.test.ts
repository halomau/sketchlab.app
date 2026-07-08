import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/render/scene", () => ({
  scene: {
    addNode: vi.fn(),
    updateNode: vi.fn(),
    updateEdge: vi.fn(),
    rebuild: vi.fn(),
    requestRender: vi.fn(),
  },
}));

import {
  bringForward,
  bringToFront,
  createShape,
  loadBoard,
  sendBackward,
  sendToBack,
} from "../src/state/actions";
import { elevationOf, STACK_STEP } from "../src/render/shading";
import { doc } from "../src/state/store";
import type { Board } from "../src/state/types";

function emptyBoard(): Board {
  return { name: "t", shapes: {}, edges: {}, order: [] };
}

beforeEach(() => {
  loadBoard(emptyBoard());
});

describe("bring/send front/back", () => {
  it("nudges lift by STACK_STEP without changing the named floor", () => {
    const a = createShape("circle", 0, 0, 100, 100, { layer: 1 });
    const b = createShape("circle", 20, 20, 100, 100, { layer: 1 });

    bringForward([a.id]);
    expect(doc.board.shapes[a.id].layer).toBe(1);
    expect(doc.board.shapes[a.id].lift).toBe(STACK_STEP);
    expect(elevationOf(doc.board.shapes[a.id]) - elevationOf(doc.board.shapes[b.id])).toBe(
      STACK_STEP,
    );

    sendBackward([a.id]);
    expect(doc.board.shapes[a.id].lift).toBeUndefined();
    expect(doc.board.shapes[a.id].layer).toBe(1);
  });

  it("bringToFront sits just above same-floor peers; sendToBack just below", () => {
    const back = createShape("rect", 0, 0, 100, 100);
    const mid = createShape("rect", 10, 10, 100, 100);
    const front = createShape("rect", 20, 20, 100, 100);
    mid.lift = 10;
    front.lift = 20;

    bringToFront([back.id]);
    expect(doc.board.shapes[back.id].layer).toBe(0);
    expect(doc.board.shapes[back.id].lift).toBe(20 + STACK_STEP);

    sendToBack([front.id]);
    // peers still in play: mid@10, back@25 → just below the lowest
    expect(doc.board.shapes[front.id].layer).toBe(0);
    expect(doc.board.shapes[front.id].lift).toBe(10 - STACK_STEP);
  });

  it("ignores peers on other named floors when computing to-front / to-back", () => {
    const ground = createShape("circle", 0, 0, 80, 80, { layer: 0 });
    const upper = createShape("circle", 0, 0, 80, 80, { layer: 2 });
    upper.lift = 100;

    bringToFront([ground.id]);
    expect(doc.board.shapes[ground.id].lift).toBe(STACK_STEP);
    expect(doc.board.shapes[ground.id].layer).toBe(0);
  });
});
