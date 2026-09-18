import assert from "node:assert/strict";
import { test } from "node:test";
import { maskInstagramUsername } from "./instagram-identity.ts";

/**
 * 길이 구간별 prefix/suffix 경계값과 스펙 예시(`pledis_boos`)를 검증한다.
 * 가운데 마스크는 항상 고정 4글자(`****`)이고 `@` 접두사가 붙는다.
 */
test("길이 1~3 — 첫 1글자만 노출", () => {
  assert.equal(maskInstagramUsername("a"), "@a****");
  assert.equal(maskInstagramUsername("ab"), "@a****");
  assert.equal(maskInstagramUsername("abc"), "@a****");
});

test("길이 4~6 — 첫 2글자만 노출, 끝은 없음", () => {
  assert.equal(maskInstagramUsername("abcd"), "@ab****");
  assert.equal(maskInstagramUsername("abcde"), "@ab****");
  assert.equal(maskInstagramUsername("abcdef"), "@ab****");
});

test("길이 7~9 — 첫 2글자 + 끝 1글자 노출", () => {
  assert.equal(maskInstagramUsername("abcdefg"), "@ab****g");
  assert.equal(maskInstagramUsername("abcdefgh"), "@ab****h");
  assert.equal(maskInstagramUsername("abcdefghi"), "@ab****i");
});

test("길이 10 이상 — 첫 3글자 + 끝 2글자 노출", () => {
  assert.equal(maskInstagramUsername("abcdefghij"), "@abc****ij");
  assert.equal(maskInstagramUsername("pledis_boos"), "@ple****os");
});
