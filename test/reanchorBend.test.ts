import { describe, expect, it } from "vitest";
import { reanchorBend } from "../src/render/geometry";

describe("reanchorBend", () => {
  it("keeps the bend on the chord midline when one endpoint translates", () => {
    // bend bows 40 above the midpoint of a horizontal chord
    const bend = { x: 100, y: -40 };
    const oldA = { x: 0, y: 0 };
    const oldB = { x: 200, y: 0 };
    // move B straight right; the bow should stay 40 and re-center on the chord
    const newB = { x: 400, y: 0 };
    const p = reanchorBend(bend, oldA, oldB, oldA, newB);
    expect(p.x).toBeCloseTo(200); // same t = 0.5 along the longer chord
    expect(p.y).toBeCloseTo(-40); // perpendicular offset preserved, not scaled
  });

  it("rotates the bend with the chord", () => {
    const bend = { x: 100, y: -40 };
    const oldA = { x: 0, y: 0 };
    const oldB = { x: 200, y: 0 };
    // rotate the chord 90°: B moves from (200,0) to (0,200)
    const newB = { x: 0, y: 200 };
    const p = reanchorBend(bend, oldA, oldB, oldA, newB);
    expect(p.x).toBeCloseTo(40); // offset now points +x (perpendicular to the new chord)
    expect(p.y).toBeCloseTo(100);
  });

  it("caps the bow at half the chord when endpoints move close together", () => {
    const bend = { x: 100, y: -80 };
    const oldA = { x: 0, y: 0 };
    const oldB = { x: 200, y: 0 };
    const newB = { x: 40, y: 0 }; // chord shrinks to 40 → max bow 20
    const p = reanchorBend(bend, oldA, oldB, oldA, newB);
    expect(p.y).toBeCloseTo(-20);
  });

  it("translates the bend when the chord is degenerate", () => {
    const a = { x: 50, y: 50 };
    const p = reanchorBend({ x: 60, y: 40 }, a, a, { x: 150, y: 50 }, { x: 150, y: 50 });
    expect(p.x).toBeCloseTo(160);
    expect(p.y).toBeCloseTo(40);
  });
});
