import { NextResponse } from "next/server";
import { acceptInvite } from "@/lib/invites";
import { getSessionParticipantId } from "@/lib/session";
import { isBackendConfigured } from "@/lib/env";

/**
 * 초대받은 사람이 /pair/[token] 플로우에서 자기 업로드(/api/upload)를 마친
 * 뒤 호출한다. 반드시 recipient 본인의 세션으로만 accept할 수 있다.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  if (!isBackendConfigured()) {
    return NextResponse.json({ error: "지금은 서비스를 준비 중이에요. 잠시 후 다시 시도해주세요." }, { status: 503 });
  }

  const { token } = await params;

  const recipientParticipantId = await getSessionParticipantId();
  if (!recipientParticipantId) {
    return NextResponse.json({ error: "먼저 내 데이터를 업로드해주세요." }, { status: 401 });
  }

  const invite = await acceptInvite(token, recipientParticipantId);
  if (!invite) {
    return NextResponse.json({ error: "존재하지 않는 링크예요." }, { status: 404 });
  }

  // acceptInvite는 만료·자기 링크·이미 다른 사람이 수락한 경우 모두
  // "아무것도 바꾸지 않고 현재 invite를 그대로" 돌려준다. 여기서 그 상태를
  // 구분해 명확한 실패 응답을 내리지 않으면, 클라이언트는 200을 성공으로
  // 오해하고 결과 조회로 넘어가 버린다.
  if (invite.status === "expired") {
    return NextResponse.json({ error: "이 링크는 만료되었어요." }, { status: 410 });
  }

  if (invite.inviterParticipantId === recipientParticipantId) {
    return NextResponse.json({ error: "자기 자신의 링크는 열 수 없어요." }, { status: 400 });
  }

  // 이미 accepted인데 recipient가 내가 아니면, 다른 사람이 먼저 이 링크로
  // 참여를 완료한 것이다 — 그 사람의 결과를 내 결과인 것처럼 보여주면 안 되므로
  // 여기서 명확히 실패로 응답한다.
  if (invite.status === "accepted" && invite.recipientParticipantId !== recipientParticipantId) {
    return NextResponse.json({ error: "이미 다른 사람이 사용한 링크예요." }, { status: 409 });
  }

  return NextResponse.json({ status: invite.status });
}
