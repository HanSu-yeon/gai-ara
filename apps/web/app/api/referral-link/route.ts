import { NextResponse, type NextRequest } from "next/server";
import { createReferralLinkSchema } from "@gai-ara/shared";
import { getOrCreateReferralLink, getReferralLinkForParticipant, getReferralVisitsForOwner } from "@/lib/referral-links";
import { getSessionParticipantId } from "@/lib/session";
import { isBackendConfigured } from "@/lib/env";

/**
 * 내 소개 링크 조회 — 없으면 404(아직 만든 적 없음). 만드는 건 POST.
 * 이 링크로 들어와서 업로드까지 마친 방문자들의 결과 목록도 함께 준다.
 */
export async function GET() {
  if (!isBackendConfigured()) {
    return NextResponse.json({ error: "지금은 서비스를 준비 중이에요. 잠시 후 다시 시도해주세요." }, { status: 503 });
  }

  const participantId = await getSessionParticipantId();
  if (!participantId) {
    return NextResponse.json({ error: "먼저 내 데이터를 업로드해주세요." }, { status: 401 });
  }

  const link = await getReferralLinkForParticipant(participantId);
  if (!link) {
    return NextResponse.json({ error: "아직 내 링크를 만들지 않았어요." }, { status: 404 });
  }
  const visits = await getReferralVisitsForOwner(participantId);
  return NextResponse.json({ ...link, visits });
}

/**
 * 내 소개 링크를 가져오거나 만든다(참여자당 하나, 재사용 가능). nickname을
 * 보내면 기존 링크의 닉네임도 갱신한다.
 */
export async function POST(request: NextRequest) {
  if (!isBackendConfigured()) {
    return NextResponse.json({ error: "지금은 서비스를 준비 중이에요. 잠시 후 다시 시도해주세요." }, { status: 503 });
  }

  const participantId = await getSessionParticipantId();
  if (!participantId) {
    return NextResponse.json({ error: "먼저 내 데이터를 업로드해주세요." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = createReferralLinkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "요청 형식이 올바르지 않아요." }, { status: 400 });
  }

  const link = await getOrCreateReferralLink(participantId, parsed.data.nickname);
  const visits = await getReferralVisitsForOwner(participantId);
  return NextResponse.json({ ...link, visits });
}
