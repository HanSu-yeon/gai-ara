import { NextResponse, type NextRequest } from "next/server";
import { instagramImportSchema } from "@gai-ara/shared";
import { hashInstagramUsername } from "@/lib/instagram-identity";
import { claimInstagramUsername, syncInstagramMutuals } from "@/lib/participants";
import { getSessionParticipantId } from "@/lib/session";
import { isBackendConfigured } from "@/lib/env";

/**
 * 2026-09-14 Instagram import 재도입 — 카카오 로그인을 이미 마친 참여자만
 * 쓸 수 있다(로그인/참여자 생성 수단이 아니다, §`AGENTS.md` §0 각주).
 * 요청 바디의 username들은 해싱 직후 버려진다: 서버 로그에 남기지 않고,
 * 응답에도 절대 포함하지 않는다.
 */
export async function POST(request: NextRequest) {
  if (!isBackendConfigured()) {
    return NextResponse.json({ error: "지금은 서비스를 준비 중이에요. 잠시 후 다시 시도해주세요." }, { status: 503 });
  }

  const participantId = await getSessionParticipantId();
  if (!participantId) {
    return NextResponse.json({ error: "먼저 로그인해주세요." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = instagramImportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "요청 형식이 올바르지 않아요." }, { status: 400 });
  }

  const { selfUsername, mutualUsernames } = parsed.data;

  const selfHash = hashInstagramUsername(selfUsername);
  const claimed = await claimInstagramUsername(participantId, selfHash);
  if (!claimed) {
    return NextResponse.json({ error: "이미 다른 계정에서 사용 중인 인스타 아이디예요." }, { status: 409 });
  }

  const mutualHashes = mutualUsernames.map(hashInstagramUsername);
  await syncInstagramMutuals(participantId, mutualHashes);

  return NextResponse.json({ mutualCount: mutualUsernames.length });
}
