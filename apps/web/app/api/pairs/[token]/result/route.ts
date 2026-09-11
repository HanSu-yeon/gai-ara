import { NextResponse } from "next/server";
import { computePairResult } from "@/lib/graph-service";
import { getInviteByToken, upsertPairResult } from "@/lib/invites";
import { getSessionParticipantId } from "@/lib/session";
import { isBackendConfigured } from "@/lib/env";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  if (!isBackendConfigured()) {
    return NextResponse.json({ error: "지금은 서비스를 준비 중이에요. 잠시 후 다시 시도해주세요." }, { status: 503 });
  }

  const { token } = await params;
  const invite = await getInviteByToken(token);

  if (!invite) {
    return NextResponse.json({ error: "존재하지 않는 링크예요." }, { status: 404 });
  }

  // 토큰만 알면 accepted 상태를 조회할 수 있으므로, 실제 거리 계산 결과는
  // 이 초대의 당사자(inviter/recipient) 세션에게만 내려준다 — 그렇지 않으면
  // 링크를 열람만 한 제3자에게도 A-B의 실제 결과가 노출된다.
  const viewerParticipantId = await getSessionParticipantId();
  const isParticipant =
    viewerParticipantId !== null &&
    (viewerParticipantId === invite.inviterParticipantId ||
      viewerParticipantId === invite.recipientParticipantId);
  if (!isParticipant) {
    return NextResponse.json({ error: "이 결과를 볼 수 없어요." }, { status: 403 });
  }

  const result = await computePairResult(
    invite.inviterParticipantId,
    invite.recipientParticipantId,
  );

  if (invite.status === "accepted") {
    await upsertPairResult(invite.id, result.distance);
  }

  return NextResponse.json(result);
}
