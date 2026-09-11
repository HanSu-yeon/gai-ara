import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { extractFollowing, InstagramExportParseError } from "../src/zip";
import { parseFollowingFromZip } from "../src/index";

function followingJson(usernames: string[]) {
  return JSON.stringify({
    relationships_following: usernames.map((value) => ({
      string_list_data: [{ href: `https://instagram.com/${value}`, value, timestamp: 0 }],
    })),
  });
}

async function buildExportZip() {
  const zip = new JSZip();
  const connections = zip.folder("connections")!.folder("followers_and_following")!;
  connections.file("following.json", followingJson(["bob", "carol", "dave"]));
  return zip.generateAsync({ type: "uint8array" });
}

describe("extractFollowing", () => {
  it("finds following.json regardless of folder depth", async () => {
    const zipBytes = await buildExportZip();
    const following = await extractFollowing(zipBytes);

    expect(following.sort()).toEqual(["bob", "carol", "dave"]);
  });

  it("throws a descriptive error when no matching file exists", async () => {
    const zip = new JSZip();
    zip.file("unrelated.json", "{}");
    const zipBytes = await zip.generateAsync({ type: "uint8array" });

    await expect(extractFollowing(zipBytes)).rejects.toBeInstanceOf(
      InstagramExportParseError,
    );
  });

  it("throws instead of silently returning zero when the matched file is corrupted", async () => {
    const zip = new JSZip();
    zip.file("connections/followers_and_following/following.json", "not valid json");
    const zipBytes = await zip.generateAsync({ type: "uint8array" });

    await expect(extractFollowing(zipBytes)).rejects.toBeInstanceOf(
      InstagramExportParseError,
    );
  });
});

describe("parseFollowingFromZip", () => {
  it("returns normalized, deduplicated following usernames", async () => {
    const zipBytes = await buildExportZip();
    expect(await parseFollowingFromZip(zipBytes)).toEqual(["bob", "carol", "dave"]);
  });

  it("excludes selfUsername from the result even if it appears in the export data", async () => {
    const zip = new JSZip();
    zip.file(
      "connections/followers_and_following/following.json",
      followingJson(["bob", "me", "carol"]),
    );
    const zipBytes = await zip.generateAsync({ type: "uint8array" });

    expect(await parseFollowingFromZip(zipBytes, "me")).toEqual(["bob", "carol"]);
  });
});

// Synthetic identifiers only: the user's export is never committed as a fixture.
it("matches title-only following entries", async () => {
  const zip = new JSZip();
  zip.file("connections/followers_and_following/following.json", JSON.stringify({
    relationships_following: ["bob", "carol"].map((title) => ({
      title, string_list_data: [{ href: `https://www.instagram.com/_u/${title}`, timestamp: 0 }],
    })),
  }));
  expect(await parseFollowingFromZip(await zip.generateAsync({ type: "uint8array" }))).toEqual(["bob", "carol"]);
});
