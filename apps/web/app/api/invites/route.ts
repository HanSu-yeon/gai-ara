import { NextResponse, type NextRequest } from "next/server";
import { createInviteSchema } from "@gai-ara/shared";
import { createInvite } from "@/lib/invites";
import { getSessionParticipantId } from "@/lib/session";
import { isBackendConfigured } from "@/lib/env";

/** "우리 몇다리인지 알아보기" 공유 링크 생성. 본인 참여가 끝난 뒤에만 가능하다. */
export async function POST(request: NextRequest) {
  if (!isBackendConfigured()) {
    return NextResponse.json({ error: "지금은 서비스를 준비 중이에요. 잠시 후 다시 시도해주세요." }, { status: 503 });
  }

  const inviterParticipantId = await getSessionParticipantId();
  if (!inviterParticipantId) {
    return NextResponse.json({ error: "먼저 내 데이터를 업로드해주세요." }, { status: 401 });
  }

  // label/nickname은 선택 입력이라 바디가 아예 없거나 비어 있어도 정상이다.
  const body = await request.json().catch(() => ({}));
  const parsed = createInviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "요청 형식이 올바르지 않아요." }, { status: 400 });
  }

  const invite = await createInvite(inviterParticipantId, {
    label: parsed.data.label,
    nickname: parsed.data.nickname,
  });
  return NextResponse.json({ token: invite.token });
}
