import { NextResponse } from "next/server";
import { getSessionParticipantId } from "@/lib/session";
import { isBackendConfigured } from "@/lib/env";

/**
 * 지금 이 브라우저가 이미 참여자 세션을 갖고 있는지만 알려준다 — 참여자
 * id나 해시 등 신원 정보는 절대 포함하지 않는다. 새 초대 링크를 열었을 때
 * "이미 참여하셨으니 재업로드 없이 바로 확인할까요?"를 보여줄지 판단하는
 * 용도다.
 */
export async function GET() {
  if (!isBackendConfigured()) {
    return NextResponse.json({ active: false });
  }
  const participantId = await getSessionParticipantId();
  return NextResponse.json({ active: participantId !== null });
}
