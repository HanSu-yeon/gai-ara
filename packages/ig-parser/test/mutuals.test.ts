import { describe, expect, it } from "vitest";
import { computeMutuals } from "../src/mutuals";

describe("computeMutuals", () => {
  it("returns only the intersection of followers and following", () => {
    const followers = ["alice", "bob", "carol"];
    const following = ["bob", "dave", "carol"];

    expect(computeMutuals(followers, following)).toEqual(["bob", "carol"]);
  });

  it("normalizes case/@ before comparing", () => {
    const followers = ["@Alice"];
    const following = ["alice"];

    expect(computeMutuals(followers, following)).toEqual(["alice"]);
  });

  it("de-duplicates repeated entries", () => {
    const followers = ["alice", "alice"];
    const following = ["alice", "alice", "alice"];

    expect(computeMutuals(followers, following)).toEqual(["alice"]);
  });

  it("returns an empty array when there is no overlap", () => {
    expect(computeMutuals(["alice"], ["bob"])).toEqual([]);
  });
});
