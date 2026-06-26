import { ICON_MAP, searchIcons } from "../render/icons";
import { computeAutoLayoutEdgeBends, computeAutoLayoutPositions } from "./autoLayout";
import { DEFAULT_TEXT_FONT_SIZE } from "./style";
import { emptyBoard } from "./store";
import type { Board, Edge, ID, Shape, ShapeKind } from "./types";

export type GeneratedNodeKind = "rect" | "circle" | "icon" | "text";

export interface GeneratedNode {
  id: string;
  label: string;
  kind?: GeneratedNodeKind;
  icon?: string;
  color?: string;
}

export interface GeneratedEdge {
  from: string;
  to: string;
  label?: string;
  directed?: boolean;
}

export interface GeneratedGraph {
  name?: string;
  nodes: GeneratedNode[];
  edges: GeneratedEdge[];
}

const HEX = /^#[0-9a-fA-F]{6}$/;
const DEFAULT_FILL = "#0f2740";
const DEFAULT_ICON = "microservice";
const NODE_W = 150;
const NODE_H = 110;
const TEXT_W = 240;
const TEXT_H = 72;
const MAX_NODES = 48;
const MAX_EDGES = 96;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(obj: Record<string, unknown>, key: string, where: string): string {
  const value = obj[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${where}.${key} must be a non-empty string`);
  }
  return value.trim();
}

function optionalString(obj: Record<string, unknown>, key: string): string | undefined {
  const value = obj[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function optionalBoolean(obj: Record<string, unknown>, key: string): boolean | undefined {
  const value = obj[key];
  return typeof value === "boolean" ? value : undefined;
}

function normalizeKind(value: unknown, icon: string | undefined): GeneratedNodeKind {
  if (value === "rect" || value === "circle" || value === "icon" || value === "text") {
    return value;
  }
  return icon ? "icon" : "rect";
}

function normalizeColor(value: string | undefined): string {
  return value && HEX.test(value) ? value : DEFAULT_FILL;
}

function normalizeIcon(value: string | undefined, label: string): string {
  if (value && ICON_MAP.has(value)) return value;
  const match = searchIcons(value ?? label)[0]?.key;
  return match && ICON_MAP.has(match) ? match : DEFAULT_ICON;
}

export function parseGeneratedGraph(value: unknown): GeneratedGraph {
  if (!isRecord(value)) throw new Error("Generated diagram must be a JSON object");

  const rawNodes = value.nodes;
  const rawEdges = value.edges;
  if (!Array.isArray(rawNodes) || rawNodes.length === 0) {
    throw new Error("Generated diagram must include at least one node");
  }
  if (rawNodes.length > MAX_NODES) {
    throw new Error(`Generated diagram has too many nodes; max is ${MAX_NODES}`);
  }
  if (rawEdges !== undefined && (!Array.isArray(rawEdges) || rawEdges.length > MAX_EDGES)) {
    throw new Error(`Generated diagram edges must be an array with at most ${MAX_EDGES} items`);
  }

  const seen = new Set<string>();
  const nodes = rawNodes.map((raw, i): GeneratedNode => {
    if (!isRecord(raw)) throw new Error(`nodes[${i}] must be an object`);
    const id = requiredString(raw, "id", `nodes[${i}]`);
    if (seen.has(id)) throw new Error(`Duplicate generated node id: ${id}`);
    seen.add(id);
    const label = requiredString(raw, "label", `nodes[${i}]`);
    const icon = optionalString(raw, "icon");
    return {
      id,
      label,
      kind: normalizeKind(raw.kind, icon),
      icon,
      color: optionalString(raw, "color"),
    };
  });

  const edges = (rawEdges ?? []).map((raw, i): GeneratedEdge => {
    if (!isRecord(raw)) throw new Error(`edges[${i}] must be an object`);
    const from = requiredString(raw, "from", `edges[${i}]`);
    const to = requiredString(raw, "to", `edges[${i}]`);
    if (!seen.has(from)) throw new Error(`edges[${i}].from references unknown node: ${from}`);
    if (!seen.has(to)) throw new Error(`edges[${i}].to references unknown node: ${to}`);
    if (from === to) throw new Error(`edges[${i}] cannot connect a node to itself`);
    return {
      from,
      to,
      label: optionalString(raw, "label") ?? "",
      directed: optionalBoolean(raw, "directed") ?? false,
    };
  });

  return {
    name: optionalString(value, "name"),
    nodes,
    edges,
  };
}

function shapeKind(kind: GeneratedNodeKind): ShapeKind {
  return kind === "text" ? "text" : kind === "circle" ? "circle" : kind === "icon" ? "icon" : "rect";
}

export function generatedGraphToBoard(graph: GeneratedGraph, fallbackName: string): Board {
  const board = emptyBoard(graph.name ?? fallbackName);
  const idMap = new Map<string, ID>();

  graph.nodes.forEach((node, index) => {
    const id = `ai_${index + 1}`;
    idMap.set(node.id, id);
    const kind = shapeKind(node.kind ?? "rect");
    const isText = kind === "text";
    const shape: Shape = {
      id,
      kind,
      x: 0,
      y: 0,
      w: isText ? TEXT_W : NODE_W,
      h: isText ? TEXT_H : NODE_H,
      fill: isText ? "transparent" : normalizeColor(node.color),
      text: node.label,
      fontSize: isText ? DEFAULT_TEXT_FONT_SIZE : 16,
    };
    if (kind === "icon") shape.icon = normalizeIcon(node.icon, node.label);
    board.shapes[id] = shape;
    board.order.push(id);
  });

  graph.edges.forEach((edge, index) => {
    const from = idMap.get(edge.from);
    const to = idMap.get(edge.to);
    if (!from || !to) return;
    const id = `ai_edge_${index + 1}`;
    const boardEdge: Edge = {
      id,
      from,
      to,
      label: edge.label ?? "",
      fontSize: 16,
      directed: edge.directed,
    };
    board.edges[id] = boardEdge;
    board.order.push(id);
  });

  const positions = computeAutoLayoutPositions(board);
  for (const [id, pos] of Object.entries(positions)) {
    board.shapes[id].x = pos.x;
    board.shapes[id].y = pos.y;
  }
  const bends = computeAutoLayoutEdgeBends(board);
  for (const [id, bend] of Object.entries(bends)) {
    const edge = board.edges[id];
    if (!edge) continue;
    edge.cx = bend.cx;
    edge.cy = bend.cy;
  }

  return board;
}
