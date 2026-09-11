import { NextResponse } from "next/server";
import { getReferralLinkNickname } from "@/lib/referral-links";
import { isBackendConfigured } from "@/lib/env";

/**
 * 소개 링크 방문 — nickname만 돌려준다. 소유자 신원(해시, participant id)은
 * 절대 응답에 포함하지 않는다.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  if (!isBackendConfigured()) {
    return NextResponse.json({ error: "지금은 서비스를 준비 중이에요. 잠시 후 다시 시도해주세요." }, { status: 503 });
  }

  const { token } = await params;
  const result = await getReferralLinkNickname(token);

  if (!result) {
    return NextResponse.json({ error: "존재하지 않는 링크예요." }, { status: 404 });
  }

  return NextResponse.json({ nickname: result.nickname });
}
