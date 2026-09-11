import { NextResponse, type NextRequest } from "next/server";
import { uploadFollowingSchema } from "@gai-ara/shared";
import { hashUsername } from "@/lib/identity";
import { syncFollowingBatch, upsertParticipant } from "@/lib/participants";
import { createSession, getSessionParticipantId } from "@/lib/session";
import { isBackendConfigured } from "@/lib/env";

/**
 * ZIP 자체나 원본 followers 목록은 절대 이 API로 오지 않는다 — 클라이언트
 * (@gai-ara/ig-parser)가 브라우저에서 ZIP을 열어 following 목록만 뽑아
 * 보낸다. followers는 이 서비스가 아예 요청하지 않는다: 맞팔 여부는
 * 서버가 두 참여자의 following을 대조해서 판정하므로, "누가 나를
 * 팔로우하는가"는 애초에 필요 없다.
 *
 * 이 요청 바디의 username들은 해싱 직후 버려진다: 서버 로그에 남기지 않고,
 * 응답에도 절대 포함하지 않는다. 이 엔드포인트를 "임의 username의 해시값을
 * 알려주는" 범용 API로 오용할 수 없도록, 인증되지 않은 조회용 엔드포인트는
 * 따로 두지 않는다(검색 기능을 만들지 않는다는 제품 원칙과 동일한 이유).
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = uploadFollowingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "요청 형식이 올바르지 않아요." }, { status: 400 });
  }

  const { selfUsername, followingUsernames } = parsed.data;

  if (!isBackendConfigured()) {
    return NextResponse.json({ error: "지금은 업로드 서비스를 준비 중이에요. 잠시 후 다시 시도해주세요." }, { status: 503 });
  }

  const selfHash = hashUsername(selfUsername);
  const { id: selfId } = await upsertParticipant(selfHash);

  const followeeHashes = followingUsernames.map(hashUsername);
  await syncFollowingBatch(selfId, followeeHashes);

  const existingSessionParticipantId = await getSessionParticipantId();
  if (existingSessionParticipantId !== selfId) {
    await createSession(selfId);
  }

  // 상대방 존재 여부, 해시값 등은 응답에 절대 포함하지 않는다.
  return NextResponse.json({ ok: true });
}
