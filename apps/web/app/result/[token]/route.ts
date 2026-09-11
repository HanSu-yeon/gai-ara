import { NextResponse } from "next/server";
import { getParticipantIdByRecoveryToken } from "@/lib/participants";
import { createSession } from "@/lib/session";
import { isBackendConfigured } from "@/lib/env";

/**
 * "내 결과 저장 링크" — 세션 쿠키가 사라져도(시크릿 모드, 다른 기기, 쿠키
 * 삭제 등) 이 토큰만 있으면 돌아올 수 있다. 토큰이 유효하면 세션을 새로
 * 발급하고 평범한 /result로 보낸다 — 화면은 그대로 재사용한다.
 *
 * 쿠키를 심어야 해서(부수효과) 일반 page.tsx가 아니라 Route Handler로
 * 만든다 — Next.js는 렌더링 중인 page 컴포넌트에서 쿠키를 못 바꾸게 막는다.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  if (isBackendConfigured()) {
    const participantId = await getParticipantIdByRecoveryToken(token);
    if (participantId) {
      await createSession(participantId);
    }
  }

  return NextResponse.redirect(new URL("/result", request.url));
}
