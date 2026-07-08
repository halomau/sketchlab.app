import {
  compileHighShaderGlProgram,
  compileHighShaderGpuProgram,
  Container,
  Graphics,
  localUniformBit,
  localUniformBitGl,
  Mesh,
  MeshGeometry,
  roundPixelsBit,
  roundPixelsBitGl,
  Shader,
  Text,
  type TextStyleOptions,
} from "pixi.js";
import type { Edge, ID, Shape } from "../state/types";
import { DEFAULT_TEXT_FONT_SIZE } from "../state/style";
import { type EdgeGeometry, quadPoints } from "./geometry";
import {
  getActiveProjector,
  type Projected,
  type Projector,
  projectBoard,
} from "./projection";
import { elevationOf, floorElevation, H_ARROW, shade, tint } from "./shading";
import {
  LABEL_FONT,
  NAMEPLATE_BACKGROUND_HEX,
  NAMEPLATE_BORDER_ALPHA,
  NAMEPLATE_BORDER_HEX,
  NAMEPLATE_FONT_WEIGHT,
  NAMEPLATE_PAD_X,
  NAMEPLATE_PAD_Y,
  NAMEPLATE_RADIUS,
  NAMEPLATE_TEXT_HEX,
  NAMEPLATE_TRACKING,
} from "./labelStyle";

/** Multi-pass cyan glow: wide+faint underlay up to a bright thin core. */
const LINE_GLOW = [
  { w: 16, color: 0x22d3ee, alpha: 0.06 },
  { w: 10, color: 0x38bdf8, alpha: 0.12 },
  { w: 6, color: 0x67e8f9, alpha: 0.22 },
  { w: 3, color: 0xa5f3fc, alpha: 0.95 },
  { w: 1.4, color: 0xecfeff, alpha: 0.9 },
];

export function lineGlow(color: string) {
  if (color === "#0f2740") {
    // navy (default fill)
    return LINE_GLOW;
  }
  // other fills require darker tone to be more distinguishable
  return [
    { w: 16, color: shade(color, 0.45), alpha: 0.08 },
    { w: 13, color: shade(color, 0.25), alpha: 0.24 },
    { w: 10, color: color, alpha: 0.95 },
    { w: 3, color: tint(color, 0.18), alpha: 0.9 },
    { w: 1.4, color: tint(color, 0.35), alpha: 0.95 },
  ];
}

const FLOW_DOT_SPACING = 34;
const FLOW_DOT_SPEED = 90;
const FLOW_RIBBON_WIDTH = 8;

const flowUniforms = {
  uTime: { value: 0, type: "f32" },
};

let flowShader: Shader | null = null;
let flowTime = 0;

export interface EdgeView {
  container: Container;
  gfx: Graphics;
  flowMesh: Mesh<MeshGeometry, Shader> | null;
  label: Text | null;
  screenPath: FlowPulsePoint[];
  screenBounds: { minX: number; minY: number; maxX: number; maxY: number } | null;
  from?: ID;
  to?: ID;
  culled: boolean;
  epoch: number;
}

export interface FlowPulsePoint {
  sx: number;
  sy: number;
  scale?: number;
}

interface FlowRibbonData {
  positions: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
}

function labelStyle(): TextStyleOptions {
  return {
    fontFamily: LABEL_FONT,
    fontSize: DEFAULT_TEXT_FONT_SIZE,
    fontWeight: NAMEPLATE_FONT_WEIGHT,
    fill: NAMEPLATE_TEXT_HEX,
    align: "center",
    letterSpacing: NAMEPLATE_TRACKING,
  };
}

function edgeLabelFontSize(edge: Edge): number {
  return edge.fontSize ?? DEFAULT_TEXT_FONT_SIZE;
}

export function updateFlowPulseShaderTime(now = performance.now()): void {
  flowTime = ((now / 1000) * FLOW_DOT_SPEED) / FLOW_DOT_SPACING;
  if (flowShader) flowShader.resources.flowUniforms.uniforms.uTime = flowTime;
}

function getFlowShader(): Shader {
  if (flowShader) return flowShader;
  const flowBit = {
    name: "edge-flow-pulse",
    fragment: {
      header: /* glsl */ `
        uniform float uTime;
      `,
      main: /* glsl */ `
        float stripe = fract(vUV.x - uTime);
        float head = smoothstep(0.02, 0.16, stripe) * (1.0 - smoothstep(0.16, 0.34, stripe));
        float side = 1.0 - smoothstep(0.25, 1.0, abs(vUV.y));
        float alpha = side * (0.10 + head * 0.82);
        vec3 color = mix(vec3(0.4078, 0.9098, 0.9765), vec3(0.9255, 0.9961, 1.0), head);
        outColor = vec4(color * alpha, alpha);
      `,
    },
  };
  const flowBitGpu = {
    name: "edge-flow-pulse",
    fragment: {
      header: /* wgsl */ `
        struct FlowUniforms {
          uTime: f32,
        };

        @group(2) @binding(0) var<uniform> flowUniforms : FlowUniforms;
      `,
      main: /* wgsl */ `
        let stripe = fract(vUV.x - flowUniforms.uTime);
        let head = smoothstep(0.02, 0.16, stripe) * (1.0 - smoothstep(0.16, 0.34, stripe));
        let side = 1.0 - smoothstep(0.25, 1.0, abs(vUV.y));
        let alpha = side * (0.10 + head * 0.82);
        let color = mix(vec3<f32>(0.4078, 0.9098, 0.9765), vec3<f32>(0.9255, 0.9961, 1.0), vec3<f32>(head));
        outColor = vec4<f32>(color * alpha, alpha);
      `,
    },
  };
  flowShader = new Shader({
    glProgram: compileHighShaderGlProgram({
      name: "edge-flow-pulse",
      bits: [localUniformBitGl, flowBit, roundPixelsBitGl],
    }),
    gpuProgram: compileHighShaderGpuProgram({
      name: "edge-flow-pulse",
      bits: [localUniformBit, flowBitGpu, roundPixelsBit],
    }),
    resources: { flowUniforms },
  });
  flowShader.resources.flowUniforms.uniforms.uTime = flowTime;
  return flowShader;
}

function buildFlowRibbonData(
  pts: FlowPulsePoint[],
  baseScale = 1,
  target?: FlowRibbonData,
): FlowRibbonData | null {
  if (pts.length < 2) return null;

  let total = 0;
  const lengths: number[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const len = Math.hypot(pts[i + 1].sx - pts[i].sx, pts[i + 1].sy - pts[i].sy);
    lengths.push(len);
    total += len;
  }
  if (total < 8) return null;

  const positions =
    target?.positions.length === pts.length * 4
      ? target.positions
      : new Float32Array(pts.length * 4);
  const uvs =
    target?.uvs.length === pts.length * 4 ? target.uvs : new Float32Array(pts.length * 4);
  const indices =
    target?.indices.length === (pts.length - 1) * 6
      ? target.indices
      : new Uint32Array((pts.length - 1) * 6);
  let walked = 0;

  for (let i = 0; i < pts.length; i++) {
    const prev = pts[Math.max(0, i - 1)];
    const cur = pts[i];
    const next = pts[Math.min(pts.length - 1, i + 1)];
    const dx = next.sx - prev.sx;
    const dy = next.sy - prev.sy;
    const len = Math.hypot(dx, dy) || 1;
    const scale = cur.scale ?? baseScale;
    const halfW = Math.max(2.5, FLOW_RIBBON_WIDTH * scale * 0.5);
    const nx = (-dy / len) * halfW;
    const ny = (dx / len) * halfW;
    const p = i * 4;
    positions[p] = cur.sx - nx;
    positions[p + 1] = cur.sy - ny;
    positions[p + 2] = cur.sx + nx;
    positions[p + 3] = cur.sy + ny;
    const u = walked / FLOW_DOT_SPACING;
    uvs[p] = u;
    uvs[p + 1] = -1;
    uvs[p + 2] = u;
    uvs[p + 3] = 1;
    if (i < lengths.length) walked += lengths[i];
  }

  for (let i = 0; i < pts.length - 1; i++) {
    const vi = i * 2;
    const ii = i * 6;
    indices[ii] = vi;
    indices[ii + 1] = vi + 1;
    indices[ii + 2] = vi + 2;
    indices[ii + 3] = vi + 1;
    indices[ii + 4] = vi + 3;
    indices[ii + 5] = vi + 2;
  }

  return { positions, uvs, indices };
}

function syncFlowPulseMesh(view: EdgeView, pts: FlowPulsePoint[], baseScale: number): void {
  const current = view.flowMesh?.geometry;
  const data = buildFlowRibbonData(
    pts,
    baseScale,
    current
      ? {
          positions: current.positions,
          uvs: current.uvs,
          indices: current.indices,
        }
      : undefined,
  );
  if (!data) {
    clearFlowPulseMesh(view);
    return;
  }
  if (!view.flowMesh) {
    const geometry = new MeshGeometry(data);
    view.flowMesh = new Mesh({ geometry, shader: getFlowShader() });
    view.container.addChildAt(view.flowMesh, Math.min(1, view.container.children.length));
    return;
  }
  const geometry = view.flowMesh.geometry;
  if (geometry.positions === data.positions) {
    geometry.getBuffer("aPosition").update();
  } else {
    geometry.positions = data.positions;
  }
  if (geometry.uvs === data.uvs) {
    geometry.getBuffer("aUV").update();
  } else {
    geometry.uvs = data.uvs;
  }
  if (geometry.indices === data.indices) {
    geometry.getIndex().update();
  } else {
    geometry.indices = data.indices;
  }
  view.flowMesh.visible = true;
}

function clearFlowPulseMesh(view: EdgeView): void {
  if (!view.flowMesh) return;
  view.container.removeChild(view.flowMesh);
  view.flowMesh.geometry.destroy();
  view.flowMesh.destroy();
  view.flowMesh = null;
}

export function createEdgeView(from: ID | undefined, to: ID | undefined): EdgeView {
  const container = new Container();
  const gfx = new Graphics();
  container.addChild(gfx);
  return {
    container,
    gfx,
    flowMesh: null,
    label: null,
    screenPath: [],
    screenBounds: null,
    from,
    to,
    culled: false,
    epoch: -1,
  };
}

export function destroyEdgeView(view: EdgeView): void {
  clearFlowPulseMesh(view);
  view.container.destroy({ children: true });
}

/** Recompute screen geometry for the current camera and redraw the glowing arrow. */
export function updateEdgeView(
  view: EdgeView,
  edge: Edge,
  geo: EdgeGeometry,
  from?: Shape,
  to?: Shape,
): void {
  reprojectEdgeView(view, edge, geo, getActiveProjector(), from, to);
}

export function reprojectEdgeView(
  view: EdgeView,
  edge: Edge,
  geo: EdgeGeometry,
  proj: Projector,
  from?: Shape,
  to?: Shape,
): void {
  const g = view.gfx;
  g.clear();
  const { p1, p2, ctrl, mid } = geo;
  // Each end rides its own node's hover height, so the edge draws as one
  // continuous 3D line: same-floor edges stay flat, while a cross-floor edge
  // climbs straight from the lower node up to the raised one (no vertical riser).
  // A free (unanchored) end floats on the edge's own floor instead of the ground,
  // so an arrow drawn on the active layer originates from that layer.
  const free = floorElevation(edge.layer ?? 0);
  const hFrom = (from ? elevationOf(from) : free) + H_ARROW;
  const hTo = (to ? elevationOf(to) : free) + H_ARROW;
  const world = ctrl ? quadPoints(p1, ctrl, p2, 24) : [p1, p2];
  const last = world.length - 1;
  const scr: Projected[] = [];
  for (let i = 0; i < world.length; i++) {
    const t = last > 0 ? i / last : 0;
    const p = projectBoard(proj, world[i].x, world[i].y, hFrom + (hTo - hFrom) * t);
    if (p.ok) scr.push(p);
  }
  view.screenPath = scr;
  view.screenBounds = null;
  if (scr.length >= 2) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of scr) {
      minX = Math.min(minX, p.sx);
      minY = Math.min(minY, p.sy);
      maxX = Math.max(maxX, p.sx);
      maxY = Math.max(maxY, p.sy);
    }
    view.screenBounds = { minX, minY, maxX, maxY };
    const sc = scr[Math.floor(scr.length / 2)].scale;
    for (const pass of lineGlow(edge.fill ?? "#0f2740")) {
      g.moveTo(scr[0].sx, scr[0].sy);
      for (let i = 1; i < scr.length; i++) g.lineTo(scr[i].sx, scr[i].sy);
      g.stroke({
        width: Math.max(0.5, pass.w * sc),
        color: pass.color,
        alpha: pass.alpha,
        cap: "round",
        join: "round",
      });
    }
    if (edge.directed) {
      syncFlowPulseMesh(view, scr, sc);
      const tip = scr[scr.length - 1];
      const prev = scr[scr.length - 2];
      const ang = Math.atan2(tip.sy - prev.sy, tip.sx - prev.sx);
      const len = 15 * sc;
      const spread = Math.PI / 7;
      g.moveTo(tip.sx, tip.sy)
        .lineTo(tip.sx - len * Math.cos(ang - spread), tip.sy - len * Math.sin(ang - spread))
        .lineTo(tip.sx - len * Math.cos(ang + spread), tip.sy - len * Math.sin(ang + spread))
        .closePath();
      g.fill({ color: edge.fill ?? "#0f2740", alpha: 0.95 });
    } else {
      clearFlowPulseMesh(view);
    }
  } else {
    clearFlowPulseMesh(view);
  }

  // label panel at the projected mid-point
  if (edge.label) {
    const m = projectBoard(proj, mid.x, mid.y, (hFrom + hTo) / 2);
    if (!view.label) {
      view.label = new Text({ text: edge.label, style: labelStyle(), resolution: 2 });
      view.label.anchor.set(0.5);
      view.container.addChild(view.label);
    } else {
      view.label.text = edge.label;
    }
    view.label.style.fontSize = edgeLabelFontSize(edge);
    if (m.ok) {
      const sc = Math.max(0.4, m.scale);
      view.label.visible = true;
      view.label.scale.set(sc);
      view.label.position.set(m.sx, m.sy);
      const padX = NAMEPLATE_PAD_X * sc;
      const padY = NAMEPLATE_PAD_Y * sc;
      const lw = view.label.width + padX * 2;
      const lh = view.label.height + padY * 2;
      const x = m.sx - lw / 2;
      const y = m.sy - lh / 2;
      const r = NAMEPLATE_RADIUS * sc;
      g.roundRect(x, y, lw, lh, r);
      g.fill({ color: NAMEPLATE_BACKGROUND_HEX, alpha: 0.95 });
      g.roundRect(x, y, lw, lh, r);
      g.stroke({
        width: Math.max(0.75, 1.2 * sc),
        color: NAMEPLATE_BORDER_HEX,
        alpha: NAMEPLATE_BORDER_ALPHA,
      });
    } else {
      view.label.visible = false;
    }
  } else if (view.label) {
    view.container.removeChild(view.label);
    view.label.destroy();
    view.label = null;
  }
}
