import { NextResponse } from "next/server";
import { getReferralLinkPublicInfo } from "@/lib/referral-links";
import { isBackendConfigured } from "@/lib/env";

/**
 * 소개 링크 방문 — 존재 여부와 소유자 표시 이름만 확인해준다(TASK-003(v2)부터
 * `ownerDisplayName` 추가, v2 명세 §3.3). 소유자 신원(해시, participant id
 * 등)은 절대 응답에 포함하지 않는다 — 링크는 카톡/DM/커뮤니티 게시글 등
 * 바깥 맥락에서 이미 누구의 링크인지 알려진 채로 공유되는 걸 전제로 한다.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  if (!isBackendConfigured()) {
    return NextResponse.json({ error: "지금은 서비스를 준비 중이에요. 잠시 후 다시 시도해주세요." }, { status: 503 });
  }

  const { token } = await params;
  const info = await getReferralLinkPublicInfo(token);

  if (!info) {
    return NextResponse.json({ error: "존재하지 않는 링크예요." }, { status: 404 });
  }

  return NextResponse.json({ ownerDisplayName: info.ownerDisplayName });
}
