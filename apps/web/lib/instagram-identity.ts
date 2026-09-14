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
