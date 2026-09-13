import { NextResponse } from "next/server";
import { confirmAcquaintanceLink } from "@/lib/acquaintance-links";
import { getSessionParticipantId } from "@/lib/session";
import { isBackendConfigured } from "@/lib/env";

/**
 * 화면 04 "네, 알고 있어요"가 호출한다(v2 명세 §3.2). 수신자 본인 세션이
 * 필수다 — 세션이 없으면 먼저 카카오 로그인/표시 이름 설정을 마쳐야 한다.
 * 에러 코드: 없음(404) · 폐기됨(410) · 자기 자신의 링크(400).
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  if (!isBackendConfigured()) {
    return NextResponse.json({ error: "지금은 서비스를 준비 중이에요. 잠시 후 다시 시도해주세요." }, { status: 503 });
  }

  const { token } = await params;

  const confirmerParticipantId = await getSessionParticipantId();
  if (!confirmerParticipantId) {
    return NextResponse.json({ error: "먼저 로그인해주세요." }, { status: 401 });
  }

  const result = await confirmAcquaintanceLink(token, confirmerParticipantId);
  if (result.ok) {
    return NextResponse.json({ ok: true });
  }

  const errorsByReason = {
    "not-found": { message: "존재하지 않는 링크예요.", status: 404 },
    revoked: { message: "더 이상 사용할 수 없는 링크예요.", status: 410 },
    self: { message: "자기 자신의 링크는 확인할 수 없어요.", status: 400 },
  } as const;

  const { message, status } = errorsByReason[result.reason];
  return NextResponse.json({ error: message }, { status });
}
