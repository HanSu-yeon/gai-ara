import { NextResponse } from "next/server";
import { getReferralLinkOwner, recordReferralVisit } from "@/lib/referral-links";
import { getSessionParticipantId } from "@/lib/session";
import { computePairResult } from "@/lib/graph-service";
import { isBackendConfigured } from "@/lib/env";

/**
 * 지금 세션(방문자)과 이 소개 링크 owner 사이의 거리를 그 자리에서
 * 계산해서 돌려준다. owner가 나중에 다시 볼 수 있도록 (링크, 방문자) 기준
 * 결과를 남긴다 — 다만 중간 연결자는 그래프 계산 자체가 절대 돌려주지
 * 않으므로 이 기록과 무관하게 계속 보호된다. nickname은 방문자가 원할
 * 때만 남기는 선택 값이라 body로 받는다(부수효과가 있어 GET이 아니라
 * POST).
 */
export async function POST(
  request: Request,
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
    return NextResponse.json({ error: "먼저 내 데이터를 업로드해주세요." }, { status: 401 });
  }

  if (participantId === link.ownerParticipantId) {
    return NextResponse.json({ status: "self", distance: null });
  }

  const body = await request.json().catch(() => ({}));
  const nickname = typeof body?.nickname === "string" ? body.nickname : undefined;

  const result = await computePairResult(link.ownerParticipantId, participantId);
  // computePairResult는 recipient가 null일 때 "pending"을 반환하지만, 여기서는
  // participantId가 항상 존재하므로 "pending"이 나올 일이 없다 — connected 또는
  // unreachable만 반환된다.
  await recordReferralVisit(link.id, participantId, nickname, result.status as "connected" | "unreachable", result.distance);

  return NextResponse.json({ status: result.status, distance: result.distance });
}
