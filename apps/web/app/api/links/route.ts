import { NextResponse } from "next/server";
import { createOrRotateAcquaintanceLink, getActiveAcquaintanceLinkForOwner } from "@/lib/acquaintance-links";
import { getSessionParticipantId } from "@/lib/session";
import { isBackendConfigured } from "@/lib/env";

/**
 * 내 재사용 지인 링크 조회(화면 03을 다시 열었을 때 회전 없이 그대로
 * 보여주기 위함) — 없으면 404. v2 명세 §3.2에는 명시되지 않은 조회 전용
 * 보조 엔드포인트다. `POST /api/links`가 호출할 때마다 기존 링크를
 * 폐기하고 새로 만들기 때문에, 이 GET이 없으면 화면을 다시 열 때마다
 * 공유해둔 링크가 깨진다 — 기존 `GET/POST /api/referral-link` 패턴과
 * 대칭을 맞췄다.
 */
export async function GET() {
  if (!isBackendConfigured()) {
    return NextResponse.json({ error: "지금은 서비스를 준비 중이에요. 잠시 후 다시 시도해주세요." }, { status: 503 });
  }

  const participantId = await getSessionParticipantId();
  if (!participantId) {
    return NextResponse.json({ error: "먼저 로그인해주세요." }, { status: 401 });
  }

  const link = await getActiveAcquaintanceLinkForOwner(participantId);
  if (!link) {
    return NextResponse.json({ error: "아직 지인 링크를 만들지 않았어요." }, { status: 404 });
  }

  return NextResponse.json(link);
}

/**
 * 지인 링크를 만들거나 재발급한다(v2 명세 §3.2). 기존 유효 링크가 있으면
 * 폐기하고 새로 만든다 — 참여자당 유효한 링크는 항상 하나뿐이다.
 */
export async function POST() {
  if (!isBackendConfigured()) {
    return NextResponse.json({ error: "지금은 서비스를 준비 중이에요. 잠시 후 다시 시도해주세요." }, { status: 503 });
  }

  const participantId = await getSessionParticipantId();
  if (!participantId) {
    return NextResponse.json({ error: "먼저 로그인해주세요." }, { status: 401 });
  }

  const link = await createOrRotateAcquaintanceLink(participantId);
  return NextResponse.json(link);
}
