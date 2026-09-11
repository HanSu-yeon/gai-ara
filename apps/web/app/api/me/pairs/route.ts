import { NextResponse } from "next/server";
import { listInvitesForParticipant } from "@/lib/invites";
import { getSessionParticipantId } from "@/lib/session";
import { isBackendConfigured } from "@/lib/env";

/**
 * 내가 inviter거나 recipient인 "우리 몇다리?" 기록 전부를 최신순으로
 * 돌려준다. 링크를 잃어버려도 세션이 살아있는 동안은 다시 확인할 수 있게
 * 하기 위한 엔드포인트 — 상대방의 신원은 절대 포함하지 않는다.
 */
export async function GET() {
  if (!isBackendConfigured()) {
    return NextResponse.json({ error: "지금은 서비스를 준비 중이에요. 잠시 후 다시 시도해주세요." }, { status: 503 });
  }

  const participantId = await getSessionParticipantId();
  if (!participantId) {
    return NextResponse.json({ error: "아직 참여 기록이 없어요." }, { status: 401 });
  }

  const pairs = await listInvitesForParticipant(participantId);
  return NextResponse.json({ pairs });
}
