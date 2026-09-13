import { NextResponse, type NextRequest } from "next/server";
import { updateDisplayNameSchema } from "@gai-ara/shared";
import { setDisplayName } from "@/lib/participants";
import { getSessionParticipantId } from "@/lib/session";
import { isBackendConfigured } from "@/lib/env";

/**
 * 화면 02(최초 온보딩)와 이후 설정 변경에 동일하게 쓴다(v2 명세 §3.1).
 * 로그인 프로필에서 자동으로 채우지 않고, 여기로 사용자가 직접 입력한
 * 값만 `participants.displayName`에 저장한다.
 */
export async function PATCH(request: NextRequest) {
  if (!isBackendConfigured()) {
    return NextResponse.json({ error: "지금은 서비스를 준비 중이에요. 잠시 후 다시 시도해주세요." }, { status: 503 });
  }

  const participantId = await getSessionParticipantId();
  if (!participantId) {
    return NextResponse.json({ error: "먼저 로그인해주세요." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = updateDisplayNameSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "이름을 입력해주세요." }, { status: 400 });
  }

  await setDisplayName(participantId, parsed.data.displayName);
  return NextResponse.json({ ok: true });
}
