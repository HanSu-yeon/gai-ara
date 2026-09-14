import { NextResponse } from "next/server";
import { getReferralLinkOwner, revealVisitToOwner } from "@/lib/referral-links";
import { getSessionParticipantId } from "@/lib/session";
import { isBackendConfigured } from "@/lib/env";

/**
 * 방문자가 화면 09에서 "내 이름 보여주기"를 명시적으로 눌렀을 때만
 * 호출된다 — opt-in이라 자동으로는 절대 켜지지 않는다(2026-09-14 결정).
 * 이 요청 자체가 새 관계(edge)를 만들지 않는다 — 이미 있던
 * `referral_visits` 행의 공개 여부만 바꾼다.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  if (!isBackendConfigured()) {
    return NextResponse.json({ error: "지금은 서비스를 준비 중이에요. 잠시 후 다시 시도해주세요." }, { status: 503 });
  }

  const { token } = await params;
  const link = await getReferralLinkOwner(token);
  if (!link) {
    return NextResponse.json({ error: "존재하지 않는 링크예요." }, { status: 404 });
  }

  const participantId = await getSessionParticipantId();
  if (!participantId) {
    return NextResponse.json({ error: "먼저 로그인해주세요." }, { status: 401 });
  }

  await revealVisitToOwner(link.id, participantId);
  return NextResponse.json({ ok: true });
}
