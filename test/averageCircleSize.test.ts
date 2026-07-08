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

import { averageCircleSize, createShape, DEFAULT_SIZE, loadBoard } from "../src/state/actions";
import type { Board } from "../src/state/types";

function emptyBoard(): Board {
  return { name: "t", shapes: {}, edges: {}, order: [] };
}

beforeEach(() => {
  loadBoard(emptyBoard());
});

describe("averageCircleSize", () => {
  it("falls back to DEFAULT_SIZE when no disc tokens exist", () => {
    expect(averageCircleSize()).toBe(DEFAULT_SIZE);
    createShape("rect", 0, 0, 200, 200);
    expect(averageCircleSize()).toBe(DEFAULT_SIZE);
  });

  it("averages min(w,h) across existing circles and icons", () => {
    createShape("circle", 0, 0, 100, 100);
    createShape("circle", 0, 0, 200, 180);
    createShape("icon", 0, 0, 160, 160, { icon: "microservice" });
    createShape("rect", 0, 0, 500, 500);
    // (100 + min(200,180) + 160) / 3 = 440 / 3
    expect(averageCircleSize()).toBeCloseTo(440 / 3);
  });
});
