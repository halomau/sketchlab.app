import type { ID } from "../state/types";
import { MAX_SPATIAL_QUERY_CELLS, type ShapeBounds } from "./shapeSpatialIndex";

type CellKey = string;

interface CellRange {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  count: number;
}

function intersects(a: ShapeBounds, b: ShapeBounds): boolean {
  return a.maxX >= b.minX && a.minX <= b.maxX && a.maxY >= b.minY && a.minY <= b.maxY;
}

export class EdgeSpatialIndex {
  private cells = new Map<CellKey, Set<ID>>();
  private bounds = new Map<ID, ShapeBounds>();
  private edgeCells = new Map<ID, CellKey[]>();

  constructor(private readonly cellSize = 512) {}

  clear(): void {
    this.cells.clear();
    this.bounds.clear();
    this.edgeCells.clear();
  }

  upsert(id: ID, bounds: ShapeBounds): void {
    this.remove(id);
    const keys = this.keysFor(bounds);
    this.bounds.set(id, bounds);
    this.edgeCells.set(id, keys);
    for (const key of keys) {
      let cell = this.cells.get(key);
      if (!cell) {
        cell = new Set();
        this.cells.set(key, cell);
      }
      cell.add(id);
    }
  }

  remove(id: ID): void {
    const keys = this.edgeCells.get(id);
    if (!keys) return;
    for (const key of keys) {
      const cell = this.cells.get(key);
      if (!cell) continue;
      cell.delete(id);
      if (!cell.size) this.cells.delete(key);
    }
    this.edgeCells.delete(id);
    this.bounds.delete(id);
  }

  queryRect(rect: ShapeBounds): ID[] {
    const keys = this.queryKeysFor(rect);
    if (!keys) return this.scanRect(rect);
    const out: ID[] = [];
    const seen = new Set<ID>();
    for (const key of keys) {
      const cell = this.cells.get(key);
      if (!cell) continue;
      for (const id of cell) {
        if (seen.has(id)) continue;
        const bounds = this.bounds.get(id);
        if (!bounds || !intersects(bounds, rect)) continue;
        seen.add(id);
        out.push(id);
      }
    }
    return out;
  }

  allIds(): ID[] {
    return [...this.bounds.keys()];
  }

  private scanRect(rect: ShapeBounds): ID[] {
    const out: ID[] = [];
    for (const [id, bounds] of this.bounds) {
      if (intersects(bounds, rect)) out.push(id);
    }
    return out;
  }

  private cellRange(bounds: ShapeBounds): CellRange | null {
    const minX = Math.floor(bounds.minX / this.cellSize);
    const minY = Math.floor(bounds.minY / this.cellSize);
    const maxX = Math.floor(bounds.maxX / this.cellSize);
    const maxY = Math.floor(bounds.maxY / this.cellSize);
    const cols = maxX - minX + 1;
    const rows = maxY - minY + 1;
    const count = cols * rows;
    if (!Number.isFinite(count) || cols <= 0 || rows <= 0) return null;
    return { minX, minY, maxX, maxY, count };
  }

  private queryKeysFor(bounds: ShapeBounds): CellKey[] | null {
    const range = this.cellRange(bounds);
    if (!range || range.count > MAX_SPATIAL_QUERY_CELLS) return null;
    return this.keysForRange(range);
  }

  private keysFor(bounds: ShapeBounds): CellKey[] {
    const range = this.cellRange(bounds);
    if (!range) return [];
    return this.keysForRange(range);
  }

  private keysForRange(range: CellRange): CellKey[] {
    const keys: CellKey[] = [];
    for (let cy = range.minY; cy <= range.maxY; cy++) {
      for (let cx = range.minX; cx <= range.maxX; cx++) {
        keys.push(`${cx}:${cy}`);
      }
    }
    return keys;
  }
}
