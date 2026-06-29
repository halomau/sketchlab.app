import { describe, expect, it } from "vitest";
import { Container, Graphics, PerspectiveMesh, Texture } from "pixi.js";
import { createFramePhases, RenderPerfRecorder, timePhase } from "../src/render/perfStats";
import { PedestalBatch, type BatchNode } from "../src/render/pedestalBatch";
import { buildEdgeSiblingIndex, NO_FILL, resolveEdgeGeometry } from "../src/render/geometry";
import { collectGridLines } from "../src/render/boardLayers";
import { createProjector, depthAtBoard, projectBoard, unprojectBoardAt } from "../src/render/projection";
import { syncLayerOrder, type OrderedLayer } from "../src/render/renderOrder";
import { floorElevation, H_ARROW, H_PED } from "../src/render/shading";
import { boardViewportBounds, isShapeInViewport } from "../src/render/culling";
import { EdgeSpatialIndex } from "../src/render/edgeSpatialIndex";
import { InstancedPedestalBatch } from "../src/render/instancedPedestalBatch";
import { ShapeSpatialIndex } from "../src/render/shapeSpatialIndex";
import type { Edge, Shape } from "../src/state/types";
import { type NodeView, reprojectNodeLabelView } from "../src/render/shapeView";
import { makeCircleScenario } from "./perfScenarios";

class FakeLayer<T> implements OrderedLayer<T> {
  removeCalls = 0;
  addCalls = 0;

  constructor(public children: T[]) {}

  removeChildren(): unknown {
    this.removeCalls++;
    this.children = [];
    return [];
  }

  addChild(...children: T[]): unknown {
    this.addCalls++;
    this.children.push(...children);
    return children[children.length - 1];
  }
}

function recordSortFrame(recorder: RenderPerfRecorder, phaseMs: number): void {
  recorder.add({
    totalMs: phaseMs,
    phases: {
      syncBoard: 0,
      reproject: 0,
      visibility: 0,
      sort: phaseMs,
      overlay: 0,
      pixi: 0,
    },
    nodeCount: 1000,
    edgeCount: 0,
    reprojectedNodes: 0,
    reprojectedEdges: 0,
    sortedItems: 1000,
  });
}

function makeCirclePairGraph(pairCount: number): {
  shapes: Shape[];
  edges: Edge[];
  shapeRecord: Record<string, Shape>;
  edgeRecord: Record<string, Edge>;
} {
  const shapes: Shape[] = [];
  const edges: Edge[] = [];
  const shapeRecord: Record<string, Shape> = {};
  const edgeRecord: Record<string, Edge> = {};
  const cols = 25;
  const gap = 82;
  const colStep = 180;
  const rowStep = 116;
  const radius = 28;

  for (let i = 0; i < pairCount; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = (col - (cols - 1) / 2) * colStep;
    const y = (row - Math.ceil(pairCount / cols) / 2) * rowStep;
    const left: Shape = {
      id: `pair_${i}_a`,
      kind: "circle",
      x,
      y,
      w: radius * 2,
      h: radius * 2,
      fill: "#0f2740",
      text: "",
    };
    const right: Shape = {
      ...left,
      id: `pair_${i}_b`,
      x: x + gap,
    };
    const edge: Edge = {
      id: `edge_${i}`,
      from: left.id,
      to: right.id,
      label: "",
      directed: true,
    };
    shapes.push(left, right);
    edges.push(edge);
    shapeRecord[left.id] = left;
    shapeRecord[right.id] = right;
    edgeRecord[edge.id] = edge;
  }

  return { shapes, edges, shapeRecord, edgeRecord };
}

function edgeBounds(
  edge: Edge,
  edges: Record<string, Edge>,
  shapes: Record<string, Shape>,
): { minX: number; minY: number; maxX: number; maxY: number } {
  const geo = resolveEdgeGeometry(edges, shapes, edge);
  const pts = [geo.p1, geo.p2];
  if (geo.ctrl) pts.push(geo.ctrl);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY };
}

describe("render performance instrumentation", () => {
  it("unprojects new raised token positions on the active layer top plane", () => {
    const projector = createProjector(
      { focusX: 0, focusY: 0, distance: 1200, pitch: Math.PI / 3, zoom: 1 },
      { w: 800, h: 600 },
    );
    const screen = { sx: 460, sy: 330 };
    const top = floorElevation(2) + H_PED;

    const layerPoint = unprojectBoardAt(projector, screen.sx, screen.sy, top);
    const groundPoint = unprojectBoardAt(projector, screen.sx, screen.sy, 0);

    expect(layerPoint).not.toBeNull();
    expect(groundPoint).not.toBeNull();

    const layerTop = projectBoard(projector, layerPoint!.wx, layerPoint!.wy, top);
    const groundAsTop = projectBoard(projector, groundPoint!.wx, groundPoint!.wy, top);

    expect(layerTop.sx).toBeCloseTo(screen.sx, 6);
    expect(layerTop.sy).toBeCloseTo(screen.sy, 6);
    expect(Math.hypot(groundAsTop.sx - screen.sx, groundAsTop.sy - screen.sy)).toBeGreaterThan(20);
  });

  it("reprojects labels for batched circle objects when the camera changes", () => {
    const textMesh = new PerspectiveMesh({ texture: Texture.WHITE, verticesX: 8, verticesY: 8 });
    const labelContainer = new Container();
    labelContainer.addChild(textMesh);
    const view: NodeView = {
      container: new Container(),
      labelContainer,
      gfx: new Graphics(),
      iconGfx: new Graphics(),
      textMesh,
      textTexture: null,
      textW: 120,
      textH: 32,
      sprite: null,
      styleKey: "",
      textKey: "",
      srcKey: "",
      labelHidden: false,
      culled: false,
      epoch: -1,
    };
    const shape: Shape = {
      id: "labeled-circle",
      kind: "circle",
      x: -32,
      y: -32,
      w: 64,
      h: 64,
      fill: "#0f2740",
      text: "Labeled",
    };
    const firstProjector = createProjector(
      { focusX: 0, focusY: 0, distance: 5000, pitch: Math.PI / 2, zoom: 1 },
      { w: 1440, h: 900 },
    );
    const secondProjector = createProjector(
      { focusX: 250, focusY: 100, distance: 5000, pitch: Math.PI / 2, zoom: 1.25 },
      { w: 1440, h: 900 },
    );

    reprojectNodeLabelView(view, shape, firstProjector);
    const firstCorners = [...textMesh.geometry.corners];
    reprojectNodeLabelView(view, shape, secondProjector);
    const secondCorners = [...textMesh.geometry.corners];

    expect(textMesh.visible).toBe(true);
    expect(secondCorners).not.toEqual(firstCorners);
  });

  it("keeps both grid axes visible and capped at far zoom levels", () => {
    const bounds = { minX: -20_000, minY: -20_000, maxX: 20_000, maxY: 20_000 };
    for (const zoom of [0.03, 0.05, 0.08, 0.12]) {
      const projector = createProjector(
        { focusX: 0, focusY: 0, distance: 1200 / zoom, pitch: Math.PI / 3, zoom },
        { w: 1440, h: 900 },
      );
      const lines = collectGridLines(projector, bounds);
      const xAxis = lines.filter((line) => line.axis === 0);
      const yAxis = lines.filter((line) => line.axis === 1);
      expect(xAxis.length).toBeGreaterThan(2);
      expect(yAxis.length).toBeGreaterThan(2);
      expect(xAxis.length).toBeLessThanOrEqual(180);
      expect(yAxis.length).toBeLessThanOrEqual(180);
    }
  });

  it("builds deterministic 1k, 5k, and 10k circle perf scenarios", () => {
    expect(makeCircleScenario(1000, "all-visible")).toHaveLength(1000);
    expect(makeCircleScenario(5000, "mixed-colors")).toHaveLength(5000);
    expect(makeCircleScenario(10_000, "mostly-offscreen")).toHaveLength(10_000);
    expect(makeCircleScenario(1000, "selected-all").every((shape) => shape.text)).toBe(true);
    expect(makeCircleScenario(1000, "non-batchable").every((shape) => shape.fill === NO_FILL)).toBe(true);
  });

  it("uses a spatial index to narrow mostly-offscreen circle candidates", () => {
    const shapes = makeCircleScenario(10_000, "mostly-offscreen");
    const index = new ShapeSpatialIndex();
    index.rebuild(shapes);
    const projector = createProjector(
      { focusX: 0, focusY: 0, distance: 5000, pitch: Math.PI / 2, zoom: 1 },
      { w: 1440, h: 900 },
    );
    const bounds = boardViewportBounds(projector, { w: 1440, h: 900 });
    expect(bounds).not.toBeNull();
    const candidates = index.queryRect(bounds!);
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.length).toBeLessThan(2000);
  });

  it("keeps huge shape-index queries bounded near the camera horizon", () => {
    const inside: Shape = {
      id: "inside",
      kind: "rect",
      x: 0,
      y: 0,
      w: 100,
      h: 100,
      fill: "#0f2740",
      text: "",
    };
    const outside: Shape = {
      ...inside,
      id: "outside",
      x: 3_000_000,
      y: 3_000_000,
    };
    const index = new ShapeSpatialIndex();
    index.rebuild([inside, outside]);

    const candidates = index.queryRect({
      minX: -2_000_000,
      minY: -2_000_000,
      maxX: 2_000_000,
      maxY: 2_000_000,
    });

    expect(candidates.map((shape) => shape.id)).toEqual(["inside"]);
  });

  it("falls back from finite viewport bounds when a low camera angle brings the horizon into view", () => {
    const projector = createProjector(
      { focusX: 0, focusY: 0, distance: 5000, pitch: 0.1, zoom: 1 },
      { w: 1440, h: 900 },
    );

    expect(projector.horizonY).not.toBeNull();
    expect(boardViewportBounds(projector, { w: 1440, h: 900 })).toBeNull();
  });

  it("uses a spatial index to narrow mostly-offscreen edge candidates", () => {
    const edgeRecord: Record<string, Edge> = {};
    const index = new EdgeSpatialIndex();
    const cols = 40;
    for (let i = 0; i < 10_000; i++) {
      const visible = i < 140;
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = visible ? col * 90 - 1800 : 80_000 + col * 120;
      const y = visible ? row * 90 - 360 : 80_000 + row * 120;
      const edge: Edge = {
        id: `free_edge_${i}`,
        x1: x,
        y1: y,
        x2: x + 70,
        y2: y + 24,
        label: "",
      };
      edgeRecord[edge.id] = edge;
      index.upsert(edge.id, edgeBounds(edge, edgeRecord, {}));
    }
    const projector = createProjector(
      { focusX: 0, focusY: 0, distance: 5000, pitch: Math.PI / 2, zoom: 1 },
      { w: 1440, h: 900 },
    );
    const bounds = boardViewportBounds(projector, { w: 1440, h: 900 });
    expect(bounds).not.toBeNull();
    const candidates = index.queryRect(bounds!);
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.length).toBeLessThan(1000);
  });

  it("keeps huge edge-index queries bounded near the camera horizon", () => {
    const index = new EdgeSpatialIndex();
    index.upsert("inside", { minX: 0, minY: 0, maxX: 100, maxY: 100 });
    index.upsert("outside", {
      minX: 3_000_000,
      minY: 3_000_000,
      maxX: 3_000_100,
      maxY: 3_000_100,
    });

    const candidates = index.queryRect({
      minX: -2_000_000,
      minY: -2_000_000,
      maxX: 2_000_000,
      maxY: 2_000_000,
    });

    expect(candidates).toEqual(["inside"]);
  });

  it("culls offscreen shapes before they enter the pedestal batch", () => {
    const projector = createProjector(
      { focusX: 0, focusY: 0, distance: 5000, pitch: Math.PI / 2, zoom: 1 },
      { w: 1440, h: 900 },
    );
    const onscreen: Shape = {
      id: "onscreen",
      kind: "circle",
      x: -32,
      y: -32,
      w: 64,
      h: 64,
      fill: "#0f2740",
      text: "",
    };
    const offscreen: Shape = {
      ...onscreen,
      id: "offscreen",
      x: 100_000,
      y: 100_000,
    };

    expect(isShapeInViewport(onscreen, projector, { w: 1440, h: 900 })).toBe(true);
    expect(isShapeInViewport(offscreen, projector, { w: 1440, h: 900 })).toBe(false);
  });

  it("updates the GPU pedestal batch for 900 mixed on/offscreen circles inside a 60fps frame budget", () => {
    const circles: Shape[] = Array.from({ length: 900 }, (_, i) => {
      const visible = i < 120;
      const col = i % 30;
      const row = Math.floor(i / 30);
      return {
        id: `mixed_circle_${i}`,
        kind: "circle",
        x: visible ? col * 90 - 1350 : 50_000 + col * 100,
        y: visible ? row * 90 - 450 : 50_000 + row * 100,
        w: 64,
        h: 64,
        fill: "#0f2740",
        text: "",
      };
    });
    const batch = new PedestalBatch();
    const recorder = new RenderPerfRecorder();

    try {
      for (let frame = 0; frame < 90; frame++) {
        const projector = createProjector(
          {
            focusX: 0,
            focusY: 0,
            distance: 5000,
            pitch: Math.PI / 2,
            zoom: 1,
            yaw: frame * 0.002,
          },
          { w: 1440, h: 900 },
        );
        const viewport = { w: 1440, h: 900 };
        const nodes: BatchNode[] = circles
          .filter((shape) => isShapeInViewport(shape, projector, viewport))
          .map((shape) => ({
            shape,
            alpha: 1,
            depth: depthAtBoard(projector, shape.x + shape.w / 2, shape.y + shape.h / 2, H_PED),
          }));
        const phases = createFramePhases();
        const start = performance.now();
        timePhase(phases, "reproject", () => batch.update(nodes, projector));
        recorder.add({
          totalMs: performance.now() - start,
          phases,
          nodeCount: circles.length,
          edgeCount: 0,
          reprojectedNodes: nodes.length,
          reprojectedEdges: 0,
          sortedItems: nodes.length,
        });
        expect(nodes.length).toBeLessThan(circles.length);
      }
    } finally {
      batch.destroy();
    }

    const summary = recorder.summary();
    expect(summary.frames).toBe(90);
    expect(summary.last?.nodeCount).toBe(900);
    expect(summary.last?.reprojectedNodes).toBeLessThan(900);
    expect(summary.estimatedFps).toBeGreaterThanOrEqual(55);
  });

  it("reports batch mesh, vertex, and upload metrics for large circle scenarios", () => {
    const circles = makeCircleScenario(5000, "mixed-colors");
    const batch = new PedestalBatch();
    const projector = createProjector(
      { focusX: 0, focusY: 0, distance: 6500, pitch: Math.PI / 2, zoom: 1 },
      { w: 1440, h: 900 },
    );
    const nodes: BatchNode[] = circles.map((shape) => ({
      shape,
      alpha: 1,
      depth: depthAtBoard(projector, shape.x + shape.w / 2, shape.y + shape.h / 2, H_PED),
    }));

    try {
      batch.update(nodes, projector);
      const stats = batch.getStats();
      expect(stats.visibleNodes).toBe(5000);
      expect(stats.batchVertices).toBeGreaterThan(5000);
      expect(stats.batchMeshes).toBeGreaterThan(0);
      expect(stats.batchUploadBytes).toBeGreaterThan(0);
    } finally {
      batch.destroy();
    }
  });

  it("keeps instanced chip data stable across camera-only frames", () => {
    const circles = makeCircleScenario(1000, "all-visible");
    const batch = new InstancedPedestalBatch();
    const firstProjector = createProjector(
      { focusX: 0, focusY: 0, distance: 6500, pitch: Math.PI / 2, zoom: 1 },
      { w: 1440, h: 900 },
    );
    const secondProjector = createProjector(
      { focusX: 40, focusY: -20, distance: 6500, pitch: Math.PI / 2, zoom: 1.1 },
      { w: 1440, h: 900 },
    );
    const nodes = circles.map((shape) => ({ shape, alpha: 1 }));

    batch.update(nodes, firstProjector, 1);
    expect(batch.getStats().cameraOnlyFrame).toBe(false);
    batch.update(nodes, secondProjector, 1);
    expect(batch.getStats().cameraOnlyFrame).toBe(true);
    expect(batch.getStats().instances).toBe(1000);
  });

  it("collapses mixed-color instanced chips into one draw stream", () => {
    const circles = makeCircleScenario(5000, "mixed-colors");
    const batch = new InstancedPedestalBatch();
    const projector = createProjector(
      { focusX: 0, focusY: 0, distance: 6500, pitch: Math.PI / 2, zoom: 1 },
      { w: 1440, h: 900 },
    );
    batch.update(circles.map((shape) => ({ shape, alpha: 1 })), projector, 1);
    expect(batch.getStats().instances).toBe(5000);
    expect(batch.getStats().drawCalls).toBe(1);
  });

  it("updates the GPU pedestal batch for 900 full-detail circles inside a 60fps frame budget", () => {
    const circles: Shape[] = Array.from({ length: 900 }, (_, i) => {
      const col = i % 30;
      const row = Math.floor(i / 30);
      return {
        id: `circle_${i}`,
        kind: "circle",
        x: col * 100 - 1500,
        y: row * 100 - 1500,
        w: 64,
        h: 64,
        fill: "#0f2740",
        text: "",
      };
    });
    const batch = new PedestalBatch();
    const recorder = new RenderPerfRecorder();

    try {
      for (let frame = 0; frame < 90; frame++) {
        const projector = createProjector(
          {
            focusX: 0,
            focusY: 0,
            distance: 5000,
            pitch: Math.PI / 2,
            zoom: 1,
            yaw: frame * 0.002,
          },
          { w: 1440, h: 900 },
        );
        const nodes: BatchNode[] = circles.map((shape) => ({
          shape,
          alpha: 1,
          depth: depthAtBoard(projector, shape.x + shape.w / 2, shape.y + shape.h / 2, H_PED),
        }));
        const phases = createFramePhases();
        const start = performance.now();
        timePhase(phases, "reproject", () => batch.update(nodes, projector));
        recorder.add({
          totalMs: performance.now() - start,
          phases,
          nodeCount: circles.length,
          edgeCount: 0,
          reprojectedNodes: circles.length,
          reprojectedEdges: 0,
          sortedItems: circles.length,
        });
        expect(batch.visible).toBe(true);
      }
    } finally {
      batch.destroy();
    }

    const summary = recorder.summary();
    expect(summary.frames).toBe(90);
    expect(summary.last?.nodeCount).toBe(900);
    expect(summary.estimatedFps).toBeGreaterThanOrEqual(55);
  });

  it("keeps 500 edge-linked circle pairs inside a 60fps frame budget", () => {
    const { shapes, edges, shapeRecord, edgeRecord } = makeCirclePairGraph(500);
    const batch = new PedestalBatch();
    const recorder = new RenderPerfRecorder();

    try {
      for (let frame = 0; frame < 90; frame++) {
        const projector = createProjector(
          {
            focusX: 40,
            focusY: -20,
            distance: 6500,
            pitch: Math.PI / 2,
            zoom: 0.62,
            yaw: frame * 0.002,
          },
          { w: 1440, h: 900 },
        );
        const nodes: BatchNode[] = shapes.map((shape) => ({
          shape,
          alpha: 1,
          depth: depthAtBoard(projector, shape.x + shape.w / 2, shape.y + shape.h / 2, H_PED),
        }));
        const phases = createFramePhases();
        const start = performance.now();
        const edgeEntries = timePhase(phases, "reproject", () => {
          batch.update(nodes, projector);
          const siblingIndex = buildEdgeSiblingIndex(edgeRecord);
          return edges.map((edge) => {
            const geo = resolveEdgeGeometry(edgeRecord, shapeRecord, edge, siblingIndex);
            const p1 = projectBoard(projector, geo.p1.x, geo.p1.y, H_ARROW);
            const p2 = projectBoard(projector, geo.p2.x, geo.p2.y, H_ARROW);
            return {
              visible: p1.ok && p2.ok,
              depth: Math.min(
                depthAtBoard(projector, geo.p1.x, geo.p1.y, 0),
                depthAtBoard(projector, geo.p2.x, geo.p2.y, 0),
              ),
            };
          });
        });
        timePhase(phases, "sort", () => edgeEntries.sort((a, b) => b.depth - a.depth));
        recorder.add({
          totalMs: performance.now() - start,
          phases,
          nodeCount: shapes.length,
          edgeCount: edges.length,
          reprojectedNodes: shapes.length,
          reprojectedEdges: edges.length,
          sortedItems: shapes.length + edgeEntries.length,
        });
        expect(batch.visible).toBe(true);
        expect(edgeEntries.every((entry) => entry.visible)).toBe(true);
      }
    } finally {
      batch.destroy();
    }

    const summary = recorder.summary();
    expect(summary.frames).toBe(90);
    expect(summary.last?.nodeCount).toBe(1000);
    expect(summary.last?.edgeCount).toBe(500);
    expect(summary.estimatedFps).toBeGreaterThanOrEqual(55);
  });

  it("projects and depth-sorts 1000 nodes inside a 60fps frame budget", () => {
    const shapes: Shape[] = Array.from({ length: 1000 }, (_, i) => {
      const col = i % 40;
      const row = Math.floor(i / 40);
      return {
        id: `node_${i}`,
        kind: "rect",
        x: col * 130 - 2600,
        y: row * 100 - 1250,
        w: 90,
        h: 64,
        fill: "#0f2740",
        text: `Node ${i}`,
      };
    });
    const recorder = new RenderPerfRecorder();

    for (let frame = 0; frame < 90; frame++) {
      const projector = createProjector(
        {
          focusX: 0,
          focusY: 0,
          distance: 6000,
          pitch: Math.PI / 2,
          zoom: 1,
          yaw: frame * 0.002,
        },
        { w: 1440, h: 900 },
      );
      const phases = createFramePhases();
      const start = performance.now();
      const entries = timePhase(phases, "reproject", () =>
        shapes.map((shape) => {
          const top = H_PED;
          const corners = [
            projectBoard(projector, shape.x, shape.y, top),
            projectBoard(projector, shape.x + shape.w, shape.y, top),
            projectBoard(projector, shape.x + shape.w, shape.y + shape.h, top),
            projectBoard(projector, shape.x, shape.y + shape.h, top),
          ];
          return {
            visible: corners.every((corner) => corner.ok),
            depth: depthAtBoard(
              projector,
              shape.x + shape.w / 2,
              shape.y + shape.h / 2,
              top,
            ),
          };
        }),
      );
      timePhase(phases, "sort", () => entries.sort((a, b) => b.depth - a.depth));
      recorder.add({
        totalMs: performance.now() - start,
        phases,
        nodeCount: shapes.length,
        edgeCount: 0,
        reprojectedNodes: shapes.length,
        reprojectedEdges: 0,
        sortedItems: entries.length,
      });
      expect(entries.every((entry) => entry.visible)).toBe(true);
    }

    const summary = recorder.summary();
    expect(summary.frames).toBe(90);
    expect(summary.last?.nodeCount).toBe(1000);
    expect(summary.estimatedFps).toBeGreaterThanOrEqual(55);
  });

  it("keeps 1000-node layer ordering inside a 60fps frame budget", () => {
    const nodes = Array.from({ length: 1000 }, (_, i) => ({ id: i }));
    const forward = [...nodes];
    const reverse = [...nodes].reverse();
    const layer = new FakeLayer([...forward]);
    const recorder = new RenderPerfRecorder();

    for (let frame = 0; frame < 120; frame++) {
      const phases = createFramePhases();
      const start = performance.now();
      timePhase(phases, "sort", () =>
        syncLayerOrder(layer, frame % 2 === 0 ? reverse : forward),
      );
      recordSortFrame(recorder, performance.now() - start);
    }

    const summary = recorder.summary();
    expect(summary.frames).toBe(120);
    expect(summary.last?.nodeCount).toBe(1000);
    expect(summary.estimatedFps).toBeGreaterThanOrEqual(55);
    expect(layer.children).toEqual(forward);
  });

  it("does not touch the layer when the sorted order is unchanged", () => {
    const nodes = Array.from({ length: 1000 }, (_, i) => ({ id: i }));
    const layer = new FakeLayer([...nodes]);

    expect(syncLayerOrder(layer, nodes)).toBe(false);
    expect(layer.removeCalls).toBe(0);
    expect(layer.addCalls).toBe(0);
    expect(layer.children).toEqual(nodes);
  });
});
