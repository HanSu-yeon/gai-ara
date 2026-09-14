import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatChallengeListStatus,
  formatConnectionHeadline,
  formatConnectionPhrase,
} from "./distance-copy.ts";

/**
 * 홈 공개 챌린지 목록의 한 줄 상태 문구(2026-09-15 결정). 목록은 "찾는 중"과
 * "N다리 발견" 두 상태만 쓴다 — 여기서 검증하는 핵심은 목록의 "N다리"가
 * 다른 화면과 **같은 distance 규칙**(intermediaries = distance - 1)을 쓴다는
 * 점이다. 목록에서 "4다리"로 보이는 챌린지를 눌러 들어간 `/t/{token}`에서
 * "세 다리"가 나오면 안 된다.
 */
test("searching이면 참여자 수를 보여준다", () => {
  assert.equal(formatChallengeListStatus("searching", null, 312), "312명 참여 · 찾는 중");
  assert.equal(formatChallengeListStatus("searching", null, 0), "0명 참여 · 찾는 중");
});

test("found면 참여자 수 대신 발견한 거리를 보여준다", () => {
  assert.equal(formatChallengeListStatus("found", 5, 312), "4다리 발견");
  assert.equal(formatChallengeListStatus("found", 2, 87), "1다리 발견");
});

test("직접 아는 사이(distance 1)는 숫자 대신 문구로 쓴다", () => {
  assert.equal(formatChallengeListStatus("found", 1, 9), "바로 아는 사이 발견");
});

test("found인데 distance가 없으면 찾는 중으로 떨어진다", () => {
  assert.equal(formatChallengeListStatus("found", null, 42), "42명 참여 · 찾는 중");
});

test("목록의 N다리는 기존 화면들과 같은 distance 규칙을 쓴다", () => {
  // distance 5 → 목록 "4다리 발견", 상세 화면 "네 다리 건너 아는 사이".
  assert.equal(formatChallengeListStatus("found", 5, 1), "4다리 발견");
  assert.equal(formatConnectionPhrase(5), "네 다리 건너 아는 사이");
  assert.deepEqual(formatConnectionHeadline(5), { top: "네 다리 건너", bottom: "아는 사이" });
});
