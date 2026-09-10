import { NextResponse } from "next/server";
import { createInvite } from "@/lib/invites";
import { getSessionParticipantId } from "@/lib/session";

/** "우리 몇다리인지 알아보기" 공유 링크 생성. 본인 참여가 끝난 뒤에만 가능하다. */
export async function POST() {
  const inviterParticipantId = await getSessionParticipantId();
  if (!inviterParticipantId) {
    return NextResponse.json({ error: "먼저 내 데이터를 업로드해주세요." }, { status: 401 });
  }

  const invite = await createInvite(inviterParticipantId);
  return NextResponse.json({ token: invite.token });
}
