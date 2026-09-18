import { createHmac } from "node:crypto";
import { normalizeUsername } from "@gai-ara/ig-parser";

/**
 * Instagram username -> HMAC-SHA256(IDENTITY_PEPPER) 해시. 2026-09-14
 * Instagram import 재도입 — 카카오 로그인이 신원 판별의 유일한 기준이므로
 * (`AGENTS.md` §0 각주), 이 해시는 로그인/매칭에 쓰이지 않는다. 오직
 * `participants.instagramUsernameHash`(본인이 직접 확인한 자기 계정)와
 * `follows.followeeIdentityHash`(맞팔 상대 계정)를 저장·대조하는 데만
 * 쓴다 — 평문 username은 절대 저장하지 않는다(`AGENTS.md` §1 원칙 2).
 *
 * 반드시 서버에서만 호출한다. 클라이언트로 pepper가 노출되면 이 방어는
 * 전부 무력화된다.
 */
export function hashInstagramUsername(rawUsername: string): string {
  const pepper = process.env.IDENTITY_PEPPER;
  const placeholder = "change-me-to-a-random-64-char-hex-string";
  if (!pepper || pepper === placeholder) {
    throw new Error("IDENTITY_PEPPER가 설정되지 않았거나 기본값입니다. .env.local에서 무작위 값으로 교체하세요.");
  }
  return createHmac("sha256", pepper).update(normalizeUsername(rawUsername)).digest("hex");
}

const MASK = "****";

/**
 * 2026-09-19 — 표시 전용 마스킹: 길이별 prefix/suffix 글자 수만 다르고
 * 가운데는 항상 고정 4글자 `****`(실제 길이 무관, 유추 방지)다. 이미
 * `normalizeUsername`으로 정규화된 값을 받는다고 가정한다.
 */
export function maskInstagramUsername(normalizedUsername: string): string {
  const length = normalizedUsername.length;
  let prefixLength: number;
  let suffixLength: number;
  if (length <= 3) {
    prefixLength = 1;
    suffixLength = 0;
  } else if (length <= 6) {
    prefixLength = 2;
    suffixLength = 0;
  } else if (length <= 9) {
    prefixLength = 2;
    suffixLength = 1;
  } else {
    prefixLength = 3;
    suffixLength = 2;
  }

  const prefix = normalizedUsername.slice(0, prefixLength);
  const suffix = suffixLength > 0 ? normalizedUsername.slice(-suffixLength) : "";
  return `@${prefix}${MASK}${suffix}`;
}
