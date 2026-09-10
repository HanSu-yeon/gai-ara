import { expect, it } from "vitest";
import { suggestUsernameFromFilename } from "../src/filename";

it("suggests an account from standard and duplicate-download filenames", () => {
  expect(suggestUsernameFromFilename("instagram-Orange.friend_1-2026-09-10-Ab12.zip")).toBe("orange.friend_1");
  expect(suggestUsernameFromFilename("instagram-orange-2026-09-10-Ab12 (1).ZIP")).toBe("orange");
});
it("requires manual input for renamed or ambiguous files", () => {
  for (const filename of ["data.zip", "instagram--2026-09-10-Ab12.zip", "instagram-not-a-handle-2026-09-10-Ab12.zip", "instagram-orange-2026-09-10-Ab12.html"]) {
    expect(suggestUsernameFromFilename(filename)).toBeNull();
  }
});
