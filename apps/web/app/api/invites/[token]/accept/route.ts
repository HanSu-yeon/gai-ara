import { NextResponse } from "next/server";
import { acceptInvite } from "@/lib/invites";
import { getSessionParticipantId } from "@/lib/session";

/**
 * 초대받은 사람이 /pair/[token] 플로우에서 자기 업로드(/api/upload)를 마친
 * 뒤 호출한다. 반드시 recipient 본인의 세션으로만 accept할 수 있다.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const recipientParticipantId = await getSessionParticipantId();
  if (!recipientParticipantId) {
    return NextResponse.json({ error: "먼저 내 데이터를 업로드해주세요." }, { status: 401 });
  }

  const invite = await acceptInvite(token, recipientParticipantId);
  if (!invite) {
    return NextResponse.json({ error: "존재하지 않는 링크예요." }, { status: 404 });
  }

  return NextResponse.json({ status: invite.status });
}
