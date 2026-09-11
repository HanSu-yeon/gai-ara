import { NextResponse } from "next/server";
import { getInviteByToken } from "@/lib/invites";
import { isBackendConfigured } from "@/lib/env";

/**
 * 초대 링크를 연 사람에게 보여줄 최소한의 상태만 반환한다.
 * inviter의 신원(해시, id)은 절대 포함하지 않는다 — inviterNickname은
 * 예외로, inviter가 recipient에게 보여주려고 직접 적은 공개용 이름이라
 * 신원 노출이 아니다.
 */
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

  return NextResponse.json({ status: invite.status, inviterNickname: invite.inviterNickname });
}
