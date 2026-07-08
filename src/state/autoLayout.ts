import { DEFAULT_TEXT_FONT_SIZE } from "./style";
import type { Board, Edge, ID, Shape } from "./types";

export interface LayoutPosition {
  x: number;
  y: number;
}

export interface EdgeBend {
  cx: number;
  cy: number;
}

const BASE_LAYER_GAP = 460;
const NODE_GAP = 130;
const COMPONENT_GAP_X = 240;
const COMPONENT_GAP_Y = 180;
const SWEEPS = 8;
const LABEL_PAD_X = 11;
const LABEL_TRACKING = 1.5;
const LABEL_NODE_CLEARANCE = 190;
const LABEL_COLLISION_PAD_X = 36;
const LABEL_COLLISION_PAD_Y = 28;
const BEND_MIN_OFFSET = 170;
const BEND_MAX_OFFSET = 280;
const LONG_LABEL_EDGE_LENGTH = BASE_LAYER_GAP * 1.65;

type ShapeMap = Pick<Board, "shapes" | "edges" | "order">;

interface LayoutEdge {
  id: ID;
  from: ID;
  to: ID;
  labelWidth: number;
  labelHeight: number;
}

interface ComponentLayout {
  positions: Record<ID, LayoutPosition>;
  bounds: Bounds;
}

interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function orderedShapeIds(board: ShapeMap): ID[] {
  const seen = new Set<ID>();
  const ids: ID[] = [];
  for (const id of board.order) {
    if (board.shapes[id] && !seen.has(id)) {
      ids.push(id);
      seen.add(id);
    }
  }
  for (const id of Object.keys(board.shapes)) {
    if (!seen.has(id)) ids.push(id);
  }
  return ids;
}

function estimatedLabelWidth(edge: Edge): number {
  if (!edge.label) return 0;
  const fontSize = edge.fontSize ?? DEFAULT_TEXT_FONT_SIZE;
  return Math.ceil(
    edge.label.length * fontSize * 0.68 +
    Math.max(0, edge.label.length - 1) * LABEL_TRACKING +
    LABEL_PAD_X * 2,
  );
}

function estimatedLabelHeight(edge: Edge): number {
  if (!edge.label) return 0;
  const fontSize = edge.fontSize ?? DEFAULT_TEXT_FONT_SIZE;
  return Math.ceil(fontSize * 1.2 + 10);
}

function anchoredEdges(board: ShapeMap, ids = new Set(Object.keys(board.shapes))): LayoutEdge[] {
  const out: LayoutEdge[] = [];
  for (const edge of Object.values(board.edges)) {
    if (!edge.from || !edge.to || edge.from === edge.to) continue;
    if (!ids.has(edge.from) || !ids.has(edge.to)) continue;
    out.push({
      id: edge.id,
      from: edge.from,
      to: edge.to,
      labelWidth: estimatedLabelWidth(edge),
      labelHeight: estimatedLabelHeight(edge),
    });
  }
  return out;
}

function components(shapeIds: ID[], edges: LayoutEdge[]): ID[][] {
  const neighbors = new Map<ID, ID[]>();
  for (const id of shapeIds) neighbors.set(id, []);
  for (const edge of edges) {
    neighbors.get(edge.from)?.push(edge.to);
    neighbors.get(edge.to)?.push(edge.from);
  }

  const seen = new Set<ID>();
  const out: ID[][] = [];
  for (const start of shapeIds) {
    if (seen.has(start)) continue;
    const queue = [start];
    const component: ID[] = [];
    seen.add(start);
    for (let i = 0; i < queue.length; i++) {
      const id = queue[i];
      component.push(id);
      for (const next of neighbors.get(id) ?? []) {
        if (seen.has(next)) continue;
        seen.add(next);
        queue.push(next);
      }
    }
    out.push(component);
  }
  return out;
}

function componentRanks(ids: ID[], edges: LayoutEdge[], orderIndex: Map<ID, number>): Map<ID, number> {
  const idSet = new Set(ids);
  const rank = new Map<ID, number>(ids.map((id) => [id, 0]));
  const incoming = new Map<ID, LayoutEdge[]>();
  const outgoing = new Map<ID, LayoutEdge[]>();
  const indegree = new Map<ID, number>(ids.map((id) => [id, 0]));

  for (const id of ids) {
    incoming.set(id, []);
    outgoing.set(id, []);
  }
  for (const edge of edges) {
    if (!idSet.has(edge.from) || !idSet.has(edge.to)) continue;
    incoming.get(edge.to)?.push(edge);
    outgoing.get(edge.from)?.push(edge);
    indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1);
  }

  const processed = new Set<ID>();
  const queue = ids.filter((id) => (indegree.get(id) ?? 0) === 0);
  queue.sort((a, b) => (orderIndex.get(a) ?? 0) - (orderIndex.get(b) ?? 0));

  while (processed.size < ids.length) {
    const id = queue.shift() ?? ids
      .filter((candidate) => !processed.has(candidate))
      .sort((a, b) => {
        const degreeA = (incoming.get(a)?.length ?? 0) + (outgoing.get(a)?.length ?? 0);
        const degreeB = (incoming.get(b)?.length ?? 0) + (outgoing.get(b)?.length ?? 0);
        return degreeB - degreeA || (orderIndex.get(a) ?? 0) - (orderIndex.get(b) ?? 0);
      })[0];

    processed.add(id);
    const incomingRanks = (incoming.get(id) ?? [])
      .filter((edge) => processed.has(edge.from))
      .map((edge) => (rank.get(edge.from) ?? 0) + 1);
    if (incomingRanks.length) rank.set(id, Math.max(rank.get(id) ?? 0, ...incomingRanks));

    for (const edge of outgoing.get(id) ?? []) {
      if (!processed.has(edge.to)) {
        rank.set(edge.to, Math.max(rank.get(edge.to) ?? 0, (rank.get(id) ?? 0) + 1));
      }
      indegree.set(edge.to, (indegree.get(edge.to) ?? 0) - 1);
      if ((indegree.get(edge.to) ?? 0) <= 0 && !processed.has(edge.to) && !queue.includes(edge.to)) {
        queue.push(edge.to);
      }
    }
    queue.sort((a, b) => (orderIndex.get(a) ?? 0) - (orderIndex.get(b) ?? 0));
  }

  return rank;
}

function layersFromRanks(ids: ID[], ranks: Map<ID, number>, orderIndex: Map<ID, number>): ID[][] {
  const maxRank = Math.max(0, ...ids.map((id) => ranks.get(id) ?? 0));
  const layers = Array.from({ length: maxRank + 1 }, () => [] as ID[]);
  for (const id of ids) layers[ranks.get(id) ?? 0].push(id);
  for (const layer of layers) {
    layer.sort((a, b) => (orderIndex.get(a) ?? 0) - (orderIndex.get(b) ?? 0));
  }
  return layers;
}

function gapAfterLayer(layerIndex: number, edges: LayoutEdge[], ranks: Map<ID, number>): number {
  let gap = BASE_LAYER_GAP;
  for (const edge of edges) {
    const fromRank = ranks.get(edge.from) ?? 0;
    const toRank = ranks.get(edge.to) ?? 0;
    if (Math.min(fromRank, toRank) !== layerIndex || Math.abs(toRank - fromRank) !== 1) continue;
    gap = Math.max(gap, edge.labelWidth * 1.35 + LABEL_NODE_CLEARANCE);
  }
  return Math.ceil(gap);
}

function centerPositions(
  shapes: Record<ID, Shape>,
  layers: ID[][],
  edges: LayoutEdge[],
  ranks: Map<ID, number>,
): Record<ID, { x: number; y: number }> {
  const layerWidths = layers.map((layer) =>
    Math.max(1, ...layer.map((id) => shapes[id]?.w ?? 1)),
  );
  const xByLayer: number[] = [];
  let x = 0;
  for (let i = 0; i < layers.length; i++) {
    xByLayer[i] = x + layerWidths[i] / 2;
    x += layerWidths[i] + gapAfterLayer(i, edges, ranks);
  }

  const positions: Record<ID, { x: number; y: number }> = {};
  const isLongPipeline = layers.length >= 5 && layers.every((layer) => layer.length === 1);
  for (let layerIndex = 0; layerIndex < layers.length; layerIndex++) {
    const layer = layers[layerIndex];
    const totalHeight =
      layer.reduce((sum, id) => sum + (shapes[id]?.h ?? 1), 0) +
      Math.max(0, layer.length - 1) * NODE_GAP;
    const pipelineStagger = isLongPipeline ? (layerIndex % 2 === 0 ? -42 : 42) : 0;
    let y = -totalHeight / 2 + pipelineStagger;
    for (const id of layer) {
      const shape = shapes[id];
      if (!shape) continue;
      positions[id] = { x: xByLayer[layerIndex], y: y + shape.h / 2 };
      y += shape.h + NODE_GAP;
    }
  }
  return positions;
}

function orientation(a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }): number {
  const value = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
  if (Math.abs(value) < 0.001) return 0;
  return value > 0 ? 1 : 2;
}

function segmentsIntersect(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
  d: { x: number; y: number },
): boolean {
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);
  return o1 !== o2 && o3 !== o4;
}

function crossingCount(edges: LayoutEdge[], centers: Record<ID, { x: number; y: number }>): number {
  let count = 0;
  for (let i = 0; i < edges.length; i++) {
    const a = edges[i];
    const a0 = centers[a.from];
    const a1 = centers[a.to];
    if (!a0 || !a1) continue;
    for (let j = i + 1; j < edges.length; j++) {
      const b = edges[j];
      if (a.from === b.from || a.from === b.to || a.to === b.from || a.to === b.to) continue;
      const b0 = centers[b.from];
      const b1 = centers[b.to];
      if (b0 && b1 && segmentsIntersect(a0, a1, b0, b1)) count++;
    }
  }
  return count;
}

function sortByBarycenter(
  layer: ID[],
  neighborPositions: Map<ID, number[]>,
  orderIndex: Map<ID, number>,
): ID[] {
  return [...layer].sort((a, b) => {
    const aNeighbors = neighborPositions.get(a) ?? [];
    const bNeighbors = neighborPositions.get(b) ?? [];
    const aBary = aNeighbors.length
      ? aNeighbors.reduce((sum, pos) => sum + pos, 0) / aNeighbors.length
      : Number.POSITIVE_INFINITY;
    const bBary = bNeighbors.length
      ? bNeighbors.reduce((sum, pos) => sum + pos, 0) / bNeighbors.length
      : Number.POSITIVE_INFINITY;
    return aBary - bBary || (orderIndex.get(a) ?? 0) - (orderIndex.get(b) ?? 0);
  });
}

function optimizeLayers(
  shapes: Record<ID, Shape>,
  layers: ID[][],
  edges: LayoutEdge[],
  ranks: Map<ID, number>,
  orderIndex: Map<ID, number>,
): ID[][] {
  const next = layers.map((layer) => [...layer]);
  const positionsInLayer = () => {
    const positions = new Map<ID, number>();
    next.forEach((layer) => layer.forEach((id, index) => positions.set(id, index)));
    return positions;
  };

  for (let sweep = 0; sweep < SWEEPS; sweep++) {
    for (let layerIndex = 1; layerIndex < next.length; layerIndex++) {
      const pos = positionsInLayer();
      const neighborPositions = new Map<ID, number[]>();
      for (const edge of edges) {
        if ((ranks.get(edge.to) ?? 0) === layerIndex) {
          const list = neighborPositions.get(edge.to) ?? [];
          list.push(pos.get(edge.from) ?? 0);
          neighborPositions.set(edge.to, list);
        }
      }
      next[layerIndex] = sortByBarycenter(next[layerIndex], neighborPositions, orderIndex);
    }

    for (let layerIndex = next.length - 2; layerIndex >= 0; layerIndex--) {
      const pos = positionsInLayer();
      const neighborPositions = new Map<ID, number[]>();
      for (const edge of edges) {
        if ((ranks.get(edge.from) ?? 0) === layerIndex) {
          const list = neighborPositions.get(edge.from) ?? [];
          list.push(pos.get(edge.to) ?? 0);
          neighborPositions.set(edge.from, list);
        }
      }
      next[layerIndex] = sortByBarycenter(next[layerIndex], neighborPositions, orderIndex);
    }
  }

  let bestScore = crossingCount(edges, centerPositions(shapes, next, edges, ranks));
  let improved = true;
  while (improved) {
    improved = false;
    for (const layer of next) {
      for (let i = 0; i < layer.length - 1; i++) {
        const candidate = next.map((l) => [...l]);
        const targetLayer = candidate[next.indexOf(layer)];
        [targetLayer[i], targetLayer[i + 1]] = [targetLayer[i + 1], targetLayer[i]];
        const score = crossingCount(edges, centerPositions(shapes, candidate, edges, ranks));
        if (score < bestScore) {
          [layer[i], layer[i + 1]] = [layer[i + 1], layer[i]];
          bestScore = score;
          improved = true;
        }
      }
    }
  }

  return next;
}

function boundsFor(shapes: Record<ID, Shape>, positions: Record<ID, LayoutPosition>): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [id, pos] of Object.entries(positions)) {
    const shape = shapes[id];
    if (!shape) continue;
    minX = Math.min(minX, pos.x);
    minY = Math.min(minY, pos.y);
    maxX = Math.max(maxX, pos.x + shape.w);
    maxY = Math.max(maxY, pos.y + shape.h);
  }
  return { minX, minY, maxX, maxY };
}

function layoutComponent(board: ShapeMap, ids: ID[], allEdges: LayoutEdge[], orderIndex: Map<ID, number>): ComponentLayout {
  const idSet = new Set(ids);
  const edges = allEdges.filter((edge) => idSet.has(edge.from) && idSet.has(edge.to));
  const ranks = componentRanks(ids, edges, orderIndex);
  const initialLayers = layersFromRanks(ids, ranks, orderIndex);
  const layers = optimizeLayers(board.shapes, initialLayers, edges, ranks, orderIndex);
  const centers = centerPositions(board.shapes, layers, edges, ranks);
  const positions: Record<ID, LayoutPosition> = {};
  for (const id of ids) {
    const shape = board.shapes[id];
    const center = centers[id] ?? { x: 0, y: 0 };
    positions[id] = {
      x: Math.round(center.x - shape.w / 2),
      y: Math.round(center.y - shape.h / 2),
    };
  }
  return { positions, bounds: boundsFor(board.shapes, positions) };
}

function packComponents(layouts: ComponentLayout[]): Record<ID, LayoutPosition> {
  const totalArea = layouts.reduce((sum, layout) => {
    const width = layout.bounds.maxX - layout.bounds.minX;
    const height = layout.bounds.maxY - layout.bounds.minY;
    return sum + width * height;
  }, 0);
  const targetWidth = Math.max(900, Math.sqrt(Math.max(1, totalArea)) * 1.6);
  const packed: Record<ID, LayoutPosition> = {};
  let cursorX = 0;
  let cursorY = 0;
  let rowHeight = 0;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const layout of layouts) {
    const width = layout.bounds.maxX - layout.bounds.minX;
    const height = layout.bounds.maxY - layout.bounds.minY;
    if (cursorX > 0 && cursorX + width > targetWidth) {
      cursorX = 0;
      cursorY += rowHeight + COMPONENT_GAP_Y;
      rowHeight = 0;
    }

    const offsetX = cursorX - layout.bounds.minX;
    const offsetY = cursorY - layout.bounds.minY;
    for (const [id, pos] of Object.entries(layout.positions)) {
      packed[id] = {
        x: pos.x + offsetX,
        y: pos.y + offsetY,
      };
    }

    minX = Math.min(minX, layout.bounds.minX + offsetX);
    minY = Math.min(minY, layout.bounds.minY + offsetY);
    maxX = Math.max(maxX, layout.bounds.maxX + offsetX);
    maxY = Math.max(maxY, layout.bounds.maxY + offsetY);

    cursorX += width + COMPONENT_GAP_X;
    rowHeight = Math.max(rowHeight, height);
  }

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  for (const pos of Object.values(packed)) {
    pos.x = Math.round(pos.x - centerX);
    pos.y = Math.round(pos.y - centerY);
  }

  return packed;
}

function currentCenter(shape: Shape): { x: number; y: number } {
  return { x: shape.x + shape.w / 2, y: shape.y + shape.h / 2 };
}

function labelBox(edge: LayoutEdge, midpoint: { x: number; y: number }): Bounds {
  const w = edge.labelWidth + LABEL_COLLISION_PAD_X;
  const h = edge.labelHeight + LABEL_COLLISION_PAD_Y;
  return {
    minX: midpoint.x - w / 2,
    minY: midpoint.y - h / 2,
    maxX: midpoint.x + w / 2,
    maxY: midpoint.y + h / 2,
  };
}

function boxesOverlap(a: Bounds, b: Bounds): boolean {
  return !(a.maxX < b.minX || b.maxX < a.minX || a.maxY < b.minY || b.maxY < a.minY);
}

function edgeLength(edge: LayoutEdge, centers: Record<ID, { x: number; y: number }>): number {
  const from = centers[edge.from];
  const to = centers[edge.to];
  return from && to ? Math.hypot(to.x - from.x, to.y - from.y) : 0;
}

export function computeAutoLayoutEdgeBends(board: ShapeMap): Record<ID, EdgeBend> {
  const shapeIds = orderedShapeIds(board);
  if (shapeIds.length === 0) return {};

  const edges = anchoredEdges(board, new Set(shapeIds)).filter((edge) => edge.labelWidth > 0);
  if (edges.length === 0) return {};

  const centers: Record<ID, { x: number; y: number }> = {};
  for (const id of shapeIds) {
    const shape = board.shapes[id];
    if (shape) centers[id] = currentCenter(shape);
  }

  const midpoints = new Map<ID, { x: number; y: number }>();
  const crowded = new Set<ID>();
  for (const edge of edges) {
    const from = centers[edge.from];
    const to = centers[edge.to];
    if (!from || !to) continue;
    midpoints.set(edge.id, { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 });
    if (edgeLength(edge, centers) > LONG_LABEL_EDGE_LENGTH) {
      crowded.add(edge.id);
    }
  }

  for (let i = 0; i < edges.length; i++) {
    const a = edges[i];
    const aMid = midpoints.get(a.id);
    if (!aMid) continue;
    for (let j = i + 1; j < edges.length; j++) {
      const b = edges[j];
      const bMid = midpoints.get(b.id);
      if (!bMid) continue;
      if (!boxesOverlap(labelBox(a, aMid), labelBox(b, bMid))) continue;

      const aLen = edgeLength(a, centers);
      const bLen = edgeLength(b, centers);
      crowded.add(aLen >= bLen ? a.id : b.id);
    }
  }

  const bends: Record<ID, EdgeBend> = {};
  const sortedCrowded = edges.filter((edge) => crowded.has(edge.id));
  sortedCrowded.forEach((edge, index) => {
    const from = centers[edge.from];
    const to = centers[edge.to];
    if (!from || !to) return;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy) || 1;
    const px = -dy / len;
    const py = dx / len;
    const sign = index % 2 === 0 ? -1 : 1;
    const offset = Math.min(BEND_MAX_OFFSET, BEND_MIN_OFFSET + len * 0.08);
    bends[edge.id] = {
      cx: Math.round((from.x + to.x) / 2 + px * offset * sign),
      cy: Math.round((from.y + to.y) / 2 + py * offset * sign),
    };
  });

  return bends;
}

export function computeAutoLayoutPositions(board: ShapeMap): Record<ID, LayoutPosition> {
  const shapeIds = orderedShapeIds(board);
  if (shapeIds.length === 0) return {};

  const orderIndex = new Map(shapeIds.map((id, index) => [id, index]));
  const edges = anchoredEdges(board, new Set(shapeIds));
  const layouts = components(shapeIds, edges).map((ids) => layoutComponent(board, ids, edges, orderIndex));
  return packComponents(layouts);
}

export function isFullyAnchoredEdge(edge: Edge): boolean {
  return !!edge.from && !!edge.to;
}
