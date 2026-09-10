import { createHmac } from "node:crypto";
import { normalizeUsername } from "@gai-ara/ig-parser";

const PLACEHOLDER_PEPPER = "change-me-to-a-random-64-char-hex-string";

/**
 * Instagram username -> HMAC-SHA256(pepper) 해시.
 *
 * 왜 단순 SHA256(username)이 아닌가:
 *   username 후보 공간은 그리 넓지 않아서(사전 단어, 흔한 패턴) salt 없는
 *   해시는 공격자가 미리 만들어둔 rainbow table로 쉽게 역추적할 수 있다.
 *   운영자만 아는 비밀 키(pepper)를 HMAC에 섞으면, 그 키 없이는 오프라인
 *   대입 공격이 불가능해진다. 단, 이 서버 자신은 pepper를 알고 있으므로
 *   이 해시는 "익명"이 아니라 "가명(pseudonymous)"이다 — 즉 운영자는 여전히
 *   후보 username을 넣어 역추적할 수 있다는 점을 개인정보처리방침에 명시하고,
 *   pepper 접근 권한을 최소화해야 한다.
 *
 * 이 함수는 반드시 서버에서만 호출한다. 클라이언트로 pepper가 노출되면
 * 이 방어는 전부 무력화된다.
 */
export function hashUsername(rawUsername: string): string {
  const pepper = process.env.IDENTITY_PEPPER;
  if (!pepper || pepper === PLACEHOLDER_PEPPER) {
    throw new Error(
      "IDENTITY_PEPPER가 설정되지 않았거나 기본값입니다. .env.local에서 무작위 값으로 교체하세요.",
    );
  }

  const normalized = normalizeUsername(rawUsername);
  return createHmac("sha256", pepper).update(normalized).digest("hex");
}
