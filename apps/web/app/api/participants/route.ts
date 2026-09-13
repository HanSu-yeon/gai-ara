import { NextResponse } from "next/server";
import { createBootstrapParticipant } from "@/lib/participants";
import { createSession, getSessionParticipantId } from "@/lib/session";
import { isBackendConfigured } from "@/lib/env";

/**
 * Instagram 없이 참여자+세션만 만드는 최소 부트스트랩. TASK-002(카카오
 * 로그인이 생기기 전) 단계의 임시 진입점이었다 — 지금 실제 화면 중
 * 어디에서도 이 경로로 참여를 시작하지 않는다(유일한 호출부였던 옛
 * `/pair/[token]`·`LivePairPage.tsx`는 어떤 화면에서도 더 이상 링크로
 * 연결되지 않는 고아 경로다). 카카오 로그인(TASK-003)이 "로그인은 카카오만
 * 제공한다"는 제품 결정의 유일한 정식 계정 생성 경로이므로, 이 엔드포인트가
 * 프로덕션에서 그대로 열려 있으면 누구나 카카오 로그인을 완전히 건너뛰고
 * 익명 계정을 만들 수 있어 그 결정을 무력화한다. 개발/테스트 편의를 위해
 * 코드는 남기되, 프로덕션에서는 막는다.
 */
export async function POST() {
  if (!isBackendConfigured()) {
    return NextResponse.json({ error: "지금은 서비스를 준비 중이에요. 잠시 후 다시 시도해주세요." }, { status: 503 });
  }
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "카카오 로그인으로 시작해주세요." }, { status: 403 });
  }

  const existingParticipantId = await getSessionParticipantId();
  if (existingParticipantId) {
    return NextResponse.json({ ok: true });
  }

  const { id } = await createBootstrapParticipant();
  await createSession(id);

  return NextResponse.json({ ok: true });
}
