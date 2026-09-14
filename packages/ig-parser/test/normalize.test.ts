import { describe, expect, it } from "vitest";
import { extractUsernames, normalizeUsername } from "../src/normalize";

describe("normalizeUsername", () => {
  it("trims whitespace, strips leading @, lowercases", () => {
    expect(normalizeUsername("  @SomeUser ")).toBe("someuser");
    expect(normalizeUsername("plainuser")).toBe("plainuser");
  });
});

describe("extractUsernames", () => {
  it("reads the common array-of-string_list_data shape (followers_*.json)", () => {
    const json = [
      {
        title: "",
        media_list_data: [],
        string_list_data: [
          { href: "https://instagram.com/a", value: "userA", timestamp: 1 },
        ],
      },
      {
        string_list_data: [
          { href: "https://instagram.com/b", value: "userB", timestamp: 2 },
        ],
      },
    ];

    expect(extractUsernames(json).sort()).toEqual(["userA", "userB"]);
  });

  it("reads the object-wrapped shape (following.json with relationships_following key)", () => {
    const json = {
      relationships_following: [
        {
          string_list_data: [
            { href: "https://instagram.com/c", value: "userC", timestamp: 1 },
          ],
        },
      ],
    };

    expect(extractUsernames(json)).toEqual(["userC"]);
  });

  it("returns an empty array for unrelated/unexpected structures", () => {
    expect(extractUsernames({ foo: "bar" })).toEqual([]);
    expect(extractUsernames(null)).toEqual([]);
    expect(extractUsernames("not json")).toEqual([]);
  });
});

it("prefers explicit values and ignores unrelated titles", () => {
  expect(extractUsernames([
    { title: "display_name", string_list_data: [{ value: "actual_user" }] },
    { title: "unrelated" },
    { title: "Not a username", string_list_data: [] },
  ])).toEqual(["actual_user"]);
});
