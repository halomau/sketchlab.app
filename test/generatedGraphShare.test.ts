import { describe, expect, it } from "vitest";
import {
  decodeGeneratedGraphParam,
  encodeGeneratedGraph,
  generatedGraphShareUrl,
} from "../src/persistence/share";
import type { GeneratedGraph } from "../src/state/generatedGraph";

const sample: GeneratedGraph = {
  name: "Checkout",
  layers: [],
  nodes: [
    { id: "web", label: "Web", kind: "icon", icon: "browser", color: "#0f2740", layer: 0 },
    { id: "api", label: "API", kind: "icon", icon: "microservice", color: "#0f2740", layer: 0 },
  ],
  edges: [{ from: "web", to: "api", label: "HTTPS", directed: true }],
};

describe("decodeGeneratedGraphParam", () => {
  it("imports URI-encoded JSON", () => {
    const encoded = encodeURIComponent(JSON.stringify(sample));
    const board = decodeGeneratedGraphParam(encoded);
    expect(board).not.toBeNull();
    expect(board!.name).toBe("Checkout");
    expect(Object.keys(board!.shapes)).toHaveLength(2);
    expect(Object.keys(board!.edges)).toHaveLength(1);
  });

  it("imports raw JSON", () => {
    const board = decodeGeneratedGraphParam(JSON.stringify(sample));
    expect(board?.name).toBe("Checkout");
  });

  it("imports LZ-compressed graphs", () => {
    const board = decodeGeneratedGraphParam(encodeGeneratedGraph(sample));
    expect(board?.name).toBe("Checkout");
  });

  it("returns null for garbage", () => {
    expect(decodeGeneratedGraphParam("not-a-graph")).toBeNull();
  });
});

describe("generatedGraphShareUrl", () => {
  it("builds a ?g= URL", () => {
    const url = generatedGraphShareUrl(sample, "https://sketchlab.webdevcody.com/");
    expect(url.startsWith("https://sketchlab.webdevcody.com/?g=")).toBe(true);
    const g = new URL(url).searchParams.get("g")!;
    expect(decodeGeneratedGraphParam(g)?.name).toBe("Checkout");
  });
});
