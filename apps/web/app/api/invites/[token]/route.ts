import { NextResponse } from "next/server";
import { getInviteByToken } from "@/lib/invites";

/**
 * 초대 링크를 연 사람에게 보여줄 최소한의 상태만 반환한다.
 * inviter가 누구인지는 절대 응답에 포함하지 않는다.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const invite = await getInviteByToken(token);

  if (!invite) {
    return NextResponse.json({ error: "존재하지 않는 링크예요." }, { status: 404 });
  }

  return NextResponse.json({ status: invite.status });
}
