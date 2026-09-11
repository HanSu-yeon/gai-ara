import { NextResponse } from "next/server";
import { getReferralLinkOwner } from "@/lib/referral-links";
import { getSessionParticipantId } from "@/lib/session";
import { computePairResult } from "@/lib/graph-service";
import { isBackendConfigured } from "@/lib/env";

/**
 * 지금 세션(방문자)과 이 소개 링크 owner 사이의 거리를 그 자리에서
 * 계산해서 돌려준다. `pair_invites`처럼 DB에 저장하지 않는다 — owner는
 * 이 결과를 절대 볼 수 없다(방문자 목록 자체가 없으므로). 요청한
 * 사람에게만 보여주는 일회성 계산이다.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  if (!isBackendConfigured()) {
    return NextResponse.json({ error: "지금은 서비스를 준비 중이에요. 잠시 후 다시 시도해주세요." }, { status: 503 });
  }

  const { token } = await params;
  const ownerParticipantId = await getReferralLinkOwner(token);
  if (!ownerParticipantId) {
    return NextResponse.json({ error: "존재하지 않는 링크예요." }, { status: 404 });
  }

  const participantId = await getSessionParticipantId();
  if (!participantId) {
    return NextResponse.json({ error: "먼저 내 데이터를 업로드해주세요." }, { status: 401 });
  }

  if (participantId === ownerParticipantId) {
    return NextResponse.json({ status: "self", distance: null });
  }

  const result = await computePairResult(ownerParticipantId, participantId);
  // computePairResult는 recipient가 null일 때 "pending"을 반환하지만, 여기서는
  // participantId가 항상 존재하므로 "pending"이 나올 일이 없다 — connected 또는
  // unreachable만 반환된다.
  return NextResponse.json({ status: result.status, distance: result.distance });
}
