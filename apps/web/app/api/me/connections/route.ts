import { NextResponse } from "next/server";
import { listConnectionsForParticipant } from "@/lib/acquaintance-links";
import { getSessionParticipantId } from "@/lib/session";
import { isBackendConfigured } from "@/lib/env";

/**
 * 직접 연결된 상대 목록 — 삭제 기능이 없으므로 제거용 id는 포함하지
 * 않는다(v2 명세 §3.2).
 */
export async function GET() {
  if (!isBackendConfigured()) {
    return NextResponse.json({ error: "지금은 서비스를 준비 중이에요. 잠시 후 다시 시도해주세요." }, { status: 503 });
  }

  const participantId = await getSessionParticipantId();
  if (!participantId) {
    return NextResponse.json({ error: "먼저 로그인해주세요." }, { status: 401 });
  }

  const connections = await listConnectionsForParticipant(participantId);
  return NextResponse.json({ connections });
}
