import assert from "node:assert/strict";
import { test } from "node:test";
import { toSafePath } from "./safe-path.ts";

test("토큰이 든 경로는 첫 구간만 남긴다", () => {
  assert.equal(toSafePath("/t/5b5ade794ff21b3c96bdc098c03eaba5"), "/t");
  assert.equal(toSafePath("/r/abc123"), "/r");
  assert.equal(toSafePath("/invite/abc123"), "/invite");
  assert.equal(toSafePath("/result/recovery-token-here"), "/result");
});

test("알 수 없는 구간은 루트로 접는다", () => {
  assert.equal(toSafePath("/admin/secret"), "/");
  assert.equal(toSafePath("/"), "/");
  assert.equal(toSafePath(""), "/");
});

test("챌린지 화면들이 목록에 들어 있다", () => {
  assert.equal(toSafePath("/challenges"), "/challenges");
  assert.equal(toSafePath("/create"), "/create");
  assert.equal(toSafePath("/me"), "/me");
});
