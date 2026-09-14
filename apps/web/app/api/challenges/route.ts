import { NextResponse, type NextRequest } from "next/server";
import { createChallengeSchema } from "@gai-ara/shared";
import { hashInstagramUsername } from "@/lib/instagram-identity";
import { createChallenge } from "@/lib/challenges";
import { checkChallengeCreateRateLimit } from "@/lib/rate-limit";
import { getSessionParticipantId } from "@/lib/session";
import { isBackendConfigured } from "@/lib/env";

/**
 * 2026-09-14 타겟 챌린지 생성, 2026-09-15 협업형 챌린지 결정 — 생성자는
 * `createChallenge` 안에서 같은 트랜잭션으로 첫 참여자로 upsert된다.
 * `instagramUsername` 원문은 해싱 직후 버려진다(서버 로그·응답에 절대
 * 포함하지 않는다). target을 "연예인"으로 한정하지 않는다 — 사용자가
 * 궁금한 사람이면 누구든 지정할 수 있다.
 *
 * `02_API_SPECS.md` §8.6이 설계한 `participantId` 기준 rate limit(분당
 * 5회/시간당 30회)을 그대로 구현한다 — 반복 생성이 사실상 무제한 조회
 * 오라클이 되는 것을 막는다(결정 로그 2026-09-14 항목 6). 한도 초과 시
 * 응답은 "rate limit"이라는 이유도, target 존재 여부도 노출하지 않는
 * 일반적인 문구만 돌려준다.
 *
 * 2026-09-15 추가 결정 — 동일 target으로는 중복 생성하지 않는다.
 * `createChallenge`가 이미 `{ status: "created" | "duplicate", ... }`
 * (`createChallengeResultSchema`)를 돌려주므로 그대로 응답에 실어 보낸다 —
 * "duplicate"일 때 자동 합류는 여기서 하지 않는다(클라이언트가 사용자
 * 확인을 거쳐 별도로 `POST /api/challenges/{token}/join`을 호출한다).
 */
export async function POST(request: NextRequest) {
  if (!isBackendConfigured()) {
    return NextResponse.json({ error: "지금은 서비스를 준비 중이에요. 잠시 후 다시 시도해주세요." }, { status: 503 });
  }

  const participantId = await getSessionParticipantId();
  if (!participantId) {
    return NextResponse.json({ error: "먼저 로그인해주세요." }, { status: 401 });
  }

  const rateLimit = checkChallengeCreateRateLimit(participantId);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "잠시 후 다시 시도해주세요." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = createChallengeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "요청 형식이 올바르지 않아요." }, { status: 400 });
  }

  const { displayName, instagramUsername } = parsed.data;
  const targetHash = hashInstagramUsername(instagramUsername);
  const challenge = await createChallenge(participantId, displayName, targetHash);

  return NextResponse.json(challenge);
}
