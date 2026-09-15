import { NextResponse } from "next/server";
import { incrementChallengeShareCount } from "@/lib/challenges";
import { isBackendConfigured } from "@/lib/env";

/**
 * "챌린지 공유하기" 버튼이 실제로 공유/복사까지 완료됐을 때만 호출한다
 * (`TargetChallengeScreen`의 `handleShareChallenge` — 공유 시트를 취소하면
 * 호출되지 않는다). 로그인을 요구하지 않는다 — `/t/{token}`은 비로그인
 * 방문자도 열 수 있는 공개 화면이라 공유도 로그인 없이 일어날 수 있다.
 *
 * `share_count`는 운영자 전용 지표다(2026-09-15 결정) — 이 응답에도, 다른
 * 어떤 공개 API 응답에도 현재 카운트를 실어 보내지 않는다. 화면에 보여줄
 * 숫자가 아니라 운영자가 DB를 직접 조회해야만 볼 수 있는 내부 지표라서다.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  if (!isBackendConfigured()) {
    return NextResponse.json({ error: "지금은 서비스를 준비 중이에요. 잠시 후 다시 시도해주세요." }, { status: 503 });
  }

  const { token } = await params;
  await incrementChallengeShareCount(token);

  return NextResponse.json({ ok: true });
}
