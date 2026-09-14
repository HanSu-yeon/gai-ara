import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { extractFollowerData, InstagramExportParseError } from "../src/zip";
import { parseMutualsFromZip } from "../src/index";

function followersJson(usernames: string[]) {
  return JSON.stringify(
    usernames.map((value) => ({
      string_list_data: [{ href: `https://instagram.com/${value}`, value, timestamp: 0 }],
    })),
  );
}

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
  // 실제 export처럼 followers가 여러 파일로 나뉘어 있는 경우를 재현한다.
  connections.file("followers_1.json", followersJson(["alice", "bob"]));
  connections.file("followers_2.json", followersJson(["carol"]));
  connections.file("following.json", followingJson(["bob", "carol", "dave"]));
  return zip.generateAsync({ type: "uint8array" });
}

describe("extractFollowerData", () => {
  it("merges multi-part followers_*.json and finds following.json regardless of folder depth", async () => {
    const zipBytes = await buildExportZip();
    const { followers, following } = await extractFollowerData(zipBytes);

    expect(followers.sort()).toEqual(["alice", "bob", "carol"]);
    expect(following.sort()).toEqual(["bob", "carol", "dave"]);
  });

  it("throws a descriptive error when no matching files exist", async () => {
    const zip = new JSZip();
    zip.file("unrelated.json", "{}");
    const zipBytes = await zip.generateAsync({ type: "uint8array" });

    await expect(extractFollowerData(zipBytes)).rejects.toBeInstanceOf(
      InstagramExportParseError,
    );
  });
});

describe("parseMutualsFromZip", () => {
  it("returns only the mutual-follow usernames", async () => {
    const zipBytes = await buildExportZip();
    expect(await parseMutualsFromZip(zipBytes)).toEqual(["bob", "carol"]);
  });
});

// Synthetic identifiers only: the user's export is never committed as a fixture.
it("matches followers values with title-only following entries", async () => {
  const zip = new JSZip();
  zip.file("connections/followers_and_following/followers_1.json", followersJson(["alice", "bob"]));
  zip.file("connections/followers_and_following/following.json", JSON.stringify({
    relationships_following: ["bob", "carol"].map((title) => ({
      title, string_list_data: [{ href: `https://www.instagram.com/_u/${title}`, timestamp: 0 }],
    })),
  }));
  expect(await parseMutualsFromZip(await zip.generateAsync({ type: "uint8array" }))).toEqual(["bob"]);
});
