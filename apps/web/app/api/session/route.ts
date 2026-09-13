import { NextResponse } from "next/server";
import { getSessionParticipantId } from "@/lib/session";
import { getDisplayName } from "@/lib/participants";
import { isBackendConfigured } from "@/lib/env";

/**
 * 지금 이 브라우저가 이미 참여자 세션을 갖고 있는지, 표시 이름을 이미
 * 설정했는지만 알려준다 — 참여자 id나 해시 등 신원 정보는 절대 포함하지
 * 않는다. 새 초대 링크를 열었을 때 "이미 참여하셨으니 재업로드 없이 바로
 * 확인할까요?"를 보여줄지 판단하는 용도였고, TASK-003(v2)부터는 화면
 * 02(`/login`)·04(`/invite/[token]`)가 로그인/표시 이름 설정 여부를
 * 판단하는 데도 함께 쓴다.
 */
export async function GET() {
  if (!isBackendConfigured()) {
    return NextResponse.json({ active: false, hasDisplayName: false });
  }
  const participantId = await getSessionParticipantId();
  if (!participantId) {
    return NextResponse.json({ active: false, hasDisplayName: false });
  }
  const displayName = await getDisplayName(participantId);
  return NextResponse.json({ active: true, hasDisplayName: Boolean(displayName) });
}
