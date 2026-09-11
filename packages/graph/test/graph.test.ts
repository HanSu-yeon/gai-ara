import { describe, expect, it } from "vitest";
import { buildGraph } from "../src/buildGraph";
import { bfsDistances, shortestDistance } from "../src/shortestPath";
import { distanceCountsFrom } from "../src/stats";

// A - B - C - D   (E는 고립)
const edges = [
  { a: "A", b: "B" },
  { a: "B", b: "C" },
  { a: "C", b: "D" },
];

describe("buildGraph + bfsDistances", () => {
  it("computes correct hop distances along a chain", () => {
    const graph = buildGraph(edges);
    const distances = bfsDistances(graph, "A");

    expect(distances.get("A")).toBe(0);
    expect(distances.get("B")).toBe(1);
    expect(distances.get("C")).toBe(2);
    expect(distances.get("D")).toBe(3);
  });

  it("does not include unreachable nodes", () => {
    const graph = buildGraph(edges);
    const distances = bfsDistances(graph, "A");
    expect(distances.has("E")).toBe(false);
  });

  it("ignores self-loop edges", () => {
    const graph = buildGraph([{ a: "A", b: "A" }, ...edges]);
    expect(graph.get("A")?.has("A")).toBe(false);
  });
});

describe("shortestDistance", () => {
  it("returns the hop distance between two nodes", () => {
    const graph = buildGraph(edges);
    expect(shortestDistance(graph, "A", "D")).toBe(3);
    expect(shortestDistance(graph, "A", "A")).toBe(0);
  });

  it("returns null when unreachable", () => {
    const graph = buildGraph(edges);
    expect(shortestDistance(graph, "A", "E")).toBeNull();
  });

  it("never exposes intermediate nodes — only a number or null is returned", () => {
    const graph = buildGraph(edges);
    const result = shortestDistance(graph, "A", "D");
    expect(typeof result === "number" || result === null).toBe(true);
  });
});

describe("distanceCountsFrom", () => {
  it("buckets reachable nodes into direct / within2 / within3", () => {
    const graph = buildGraph(edges);
    const counts = distanceCountsFrom(graph, "A");

    expect(counts).toEqual({ direct: 1, within2: 2, within3: 3 });
  });
});
