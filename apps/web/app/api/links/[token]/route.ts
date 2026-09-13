import { NextResponse } from "next/server";
import { getAcquaintanceLinkPublicInfo } from "@/lib/acquaintance-links";
import { isBackendConfigured } from "@/lib/env";

/**
 * 지인 링크를 받은 사람(화면 04)이 로그인 전에 먼저 여는 화면이라 인증이
 * 없다(v2 명세 §3.2). 소유자의 participant id·해시는 절대 포함하지 않고
 * 표시 이름만 내려준다.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  if (!isBackendConfigured()) {
    return NextResponse.json({ error: "지금은 서비스를 준비 중이에요. 잠시 후 다시 시도해주세요." }, { status: 503 });
  }

  const { token } = await params;
  const info = await getAcquaintanceLinkPublicInfo(token);
  return NextResponse.json(info);
}
