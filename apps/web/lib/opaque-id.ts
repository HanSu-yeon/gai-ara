import { createHmac } from "node:crypto";

/**
 * `/result`의 2촌 이상 익명 노드에 쓰는 불투명 id — 실제 participant UUID를
 * 그대로 클라이언트에 내려보내지 않기 위해 HMAC으로 가린다(2026-09-14
 * 결정). 같은 사람은 항상 같은 값이 나와야 하므로(React key 안정성 — 새로
 * 나타난 사람만 mount 애니메이션이 재생되고 기존 노드는 리렌더돼도 안
 * 움직여야 함) 무작위가 아니라 입력에 대해 결정적인 해시를 쓴다. 되돌릴
 * 수 없고, 이 값만으로 조회할 수 있는 API도 없다.
 *
 * `IDENTITY_PEPPER`는 원래 Instagram username 해싱용으로 만든 비밀 키였고
 * (그 기능은 2026-09-14에 레거시로 제거됐다), 여기서 같은 키를 새 용도로
 * 재사용한다 — 이미 모든 배포 환경에 설정돼 있는 서버 전용 비밀 키이고,
 * 이 해싱도 같은 성격(민감하지 않은 내부 식별자를 가리는 용도)이라 새
 * 환경 변수를 추가하지 않는다.
 */
export function hashParticipantId(participantId: string): string {
  const pepper = process.env.IDENTITY_PEPPER;
  if (!pepper) {
    throw new Error("IDENTITY_PEPPER가 설정되지 않았거나 기본값입니다. .env.local에서 무작위 값으로 교체하세요.");
  }
  return createHmac("sha256", pepper).update(participantId).digest("hex").slice(0, 24);
}
