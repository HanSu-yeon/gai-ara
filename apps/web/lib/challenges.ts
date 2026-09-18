import { randomBytes } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { getDb, challengeParticipants, targetChallenges } from "@gai-ara/db";

export interface ChallengeRecord {
  token: string;
}

export interface ChallengeDetail {
  id: string;
  displayName: string;
  targetInstagramUsernameHash: string;
  targetInstagramUsernameMasked: string | null;
  creatorParticipantId: string;
}

export type CreateChallengeResult =
  | { status: "created"; token: string }
  | { status: "duplicate"; token: string; displayName: string };

/**
 * 새 타겟 챌린지를 만든다. 2026-09-15 협업형 챌린지 결정 — 생성자를 같은
 * 트랜잭션 안에서 첫 `challenge_participants` 행으로 upsert한다. 만든
 * 사람이 자기 기존 trusted network(이미 갖고 있는 confirmed
 * acquaintance/Instagram mutual)를 이 챌린지의 시작점으로 즉시 쓸 수
 * 있어야 하기 때문이다 — 별도로 "나도 참여하기"를 다시 누를 필요가 없다.
 *
 * 2026-09-15 추가 결정 — 같은 target(정규화된 username의 해시 기준, 즉
 * `target_challenges.target_instagram_username_hash` UNIQUE 제약)으로는
 * 챌린지를 중복 생성하지 않는다. insert가 이 UNIQUE 제약을 위반하면(이미
 * 같은 target을 가리키는 챌린지가 존재) 새 행을 만들지 않고, **호출자를
 * 그 기존 챌린지에 자동으로 합류시키지도 않는다** — `status: "duplicate"`로
 * 기존 챌린지의 `token`/`displayName`만 돌려주고, 실제 합류는 호출부
 * (`POST /api/challenges/{token}/join`)를 사용자가 명시적으로 다시 호출할
 * 때만 일어난다. displayName은 이번에 제출한 값으로 덮어쓰지 않고 최초
 * 생성 시점 값을 그대로 유지한다 — 중복 판정 자체가 displayName이 아니라
 * targetInstagramUsernameHash(정규화된 username) 기준이기 때문에, 오타나
 * 별명 차이("부승관" vs "승관")가 서로 다른 챌린지를 만들지 않는다.
 *
 * 2026-09-19 추가 — `targetInstagramUsernameMasked`(표시 전용,
 * `maskInstagramUsername()` 결과)도 함께 저장한다. 중복 감지 경로
 * (`getChallengeByTargetHash`)는 이 값을 다루지 않는다 — 중복 응답에는
 * masked 값을 추가하지 않는다(스펙 밖 범위).
 */
export async function createChallenge(
  creatorParticipantId: string,
  displayName: string,
  targetInstagramUsernameHash: string,
  targetInstagramUsernameMasked: string,
): Promise<CreateChallengeResult> {
  const db = getDb();
  const token = randomBytes(16).toString("hex");

  try {
    return await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(targetChallenges)
        .values({ creatorParticipantId, displayName, targetInstagramUsernameHash, targetInstagramUsernameMasked, token })
        .returning({ id: targetChallenges.id, token: targetChallenges.token });
      if (!row) throw new Error("challenge insert returned no row");

      await tx
        .insert(challengeParticipants)
        .values({ challengeId: row.id, participantId: creatorParticipantId })
        .onConflictDoNothing();

      return { status: "created", token: row.token };
    });
  } catch (error) {
    if (error instanceof Error && /target_instagram_username_hash/.test(error.message)) {
      const existing = await getChallengeByTargetHash(targetInstagramUsernameHash);
      if (existing) return { status: "duplicate", token: existing.token, displayName: existing.displayName };
    }
    throw error;
  }
}

/** 이미 같은 target을 가리키는 챌린지가 있는지 조회한다(내부용, 중복 생성 판정에만 쓴다). */
async function getChallengeByTargetHash(
  targetInstagramUsernameHash: string,
): Promise<{ token: string; displayName: string } | null> {
  const db = getDb();
  const [row] = await db
    .select({ token: targetChallenges.token, displayName: targetChallenges.displayName })
    .from(targetChallenges)
    .where(eq(targetChallenges.targetInstagramUsernameHash, targetInstagramUsernameHash))
    .limit(1);
  return row ?? null;
}

/**
 * 2026-09-15 협업형 챌린지 결정 — "나도 연결 보태기" 버튼을 눌러 명시적으로
 * 참여했을 때만 호출한다. `/t/{token}` 페이지 뷰만으로는 절대 호출되지
 * 않는다(page view != participation). 이미 참여한 사람이 다시 눌러도
 * 멱등하게 성공 처리한다(`ON CONFLICT DO NOTHING`) — `acquaintance_confirmations`와
 * 같은 패턴.
 *
 * 이 함수는 새 edge를 만들지 않는다 — 참여자가 이미 갖고 있는
 * confirmed acquaintance/Instagram mutual 관계 전체를 이 챌린지의
 * start-set으로 써도 된다는 멤버십 표시만 남긴다.
 */
export async function joinChallenge(challengeId: string, participantId: string): Promise<void> {
  const db = getDb();
  await db
    .insert(challengeParticipants)
    .values({ challengeId, participantId })
    .onConflictDoNothing();
}

/** 이 챌린지의 현재 start-set(명시적으로 참여한 participant id 목록)을 가져온다. */
export async function getChallengeParticipantIds(challengeId: string): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .selectDistinct({ participantId: challengeParticipants.participantId })
    .from(challengeParticipants)
    .where(eq(challengeParticipants.challengeId, challengeId));
  return rows.map((row) => row.participantId);
}

/** 특정 participant가 이미 이 챌린지에 참여했는지 확인한다("나도 연결 보태기" 버튼 상태 전환용). */
export async function hasJoinedChallenge(challengeId: string, participantId: string): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .select({ id: challengeParticipants.id })
    .from(challengeParticipants)
    .where(and(eq(challengeParticipants.challengeId, challengeId), eq(challengeParticipants.participantId, participantId)))
    .limit(1);
  return Boolean(row);
}

/** 비로그인 상태에서도 보여줄 수 있는 최소 정보 — 대상 해시나 만든 사람 신원은 포함하지 않는다. */
export async function getChallengePublicInfo(token: string): Promise<{ displayName: string } | null> {
  const db = getDb();
  const [row] = await db
    .select({ displayName: targetChallenges.displayName })
    .from(targetChallenges)
    .where(eq(targetChallenges.token, token))
    .limit(1);

  return row ?? null;
}

/**
 * 2026-09-15 "홈 공개 챌린지 목록" 결정 — 홈(화면 01)에 보여줄 공개
 * 챌린지만 가져온다. `is_public = true`로 **운영자가 직접 지정한** 챌린지만
 * 대상이며, 사용자가 만든 챌린지는 기본값(false) 그대로라 절대 여기 섞이지
 * 않는다(`AGENTS.md` §1 원칙 3 — 사람을 찾아내는 디렉터리를 만들지 않는다).
 *
 * `participantCount`는 `challenge_participants` 행 수 그대로이고, 이
 * 사람들이 곧 그 챌린지의 실제 start-set이다(`computeChallengeReachability`) —
 * 목록의 "N명 참여"는 장식이 아니라 탐색에 실제로 쓰이는 숫자다.
 *
 * `id`/`targetInstagramUsernameHash`는 진행 상황 계산(서버 전용)에만 쓰고
 * 클라이언트로 내보내지 않는다 — 홈은 서버 컴포넌트에서 이 함수를 직접
 * 호출하므로, 목록 자체를 노출하는 공개 API 라우트를 새로 만들지 않는다.
 *
 * 정렬은 참여자 수 내림차순 → 최신순이다. 검색·필터·카테고리·랭킹
 * 페이지·무한스크롤은 만들지 않는다(원래 지시 §10) — 호출부가 넘긴
 * `limit`만큼만 돌려주고, `limit`이 없으면(`/challenges` 전체 목록)
 * 공개된 챌린지를 전부 돌려준다. 공개 여부는 운영자만 켤 수 있으므로
 * 이 목록이 통제 없이 커지지 않는다.
 */
export interface PublicChallengeSummary {
  id: string;
  token: string;
  displayName: string;
  targetInstagramUsernameHash: string;
  /**
   * 2026-09-19 추가 — `/challenges`·`/me` 목록에도 상세 화면(`/t/{token}`)과
   * 같은 마스킹된 표시값을 보여준다(사용자 지정). raw username/해시는 여전히
   * 이 요약에 노출하지 않는다 — `targetInstagramUsernameHash`는 서버에서
   * 진행 상황 계산에만 쓰고 렌더링하지 않는다(기존 원칙 그대로).
   */
  targetInstagramUsernameMasked: string | null;
  participantCount: number;
}

export async function listPublicChallenges(limit?: number): Promise<PublicChallengeSummary[]> {
  const db = getDb();
  const participantCount = sql<number>`count(${challengeParticipants.id})`.mapWith(Number);

  const query = db
    .select({
      id: targetChallenges.id,
      token: targetChallenges.token,
      displayName: targetChallenges.displayName,
      targetInstagramUsernameHash: targetChallenges.targetInstagramUsernameHash,
      targetInstagramUsernameMasked: targetChallenges.targetInstagramUsernameMasked,
      participantCount,
    })
    .from(targetChallenges)
    .leftJoin(challengeParticipants, eq(challengeParticipants.challengeId, targetChallenges.id))
    .where(eq(targetChallenges.isPublic, true))
    .groupBy(targetChallenges.id)
    .orderBy(desc(participantCount), desc(targetChallenges.createdAt));

  return await (limit === undefined ? query : query.limit(limit));
}

/**
 * 2026-09-15 "내 챌린지" 결정 — `/me`가 쓴다. 내가 만들었거나(`creator_participant_id`)
 * 내가 참여한(`challenge_participants`) 챌린지를 최신순으로 전부 돌려준다.
 *
 * 만든 직후 `/t/{token}`을 벗어나면 토큰을 다시 찾을 방법이 없던 문제를
 * 해결하기 위한 조회다 — `is_public`과 무관하게, **오직 자기 자신의**
 * 챌린지만 자기에게 보여준다. 남의 챌린지를 찾아보는 용도가 아니므로
 * `AGENTS.md` §1 원칙 3의 "challenge 전체 목록/탐색" 금지와 충돌하지
 * 않는다(참여자 id를 파라미터로 받고, 세션 주인의 id만 넘어온다).
 */
export interface MyChallengeSummary extends PublicChallengeSummary {
  isCreator: boolean;
}

export async function listMyChallenges(participantId: string): Promise<MyChallengeSummary[]> {
  const db = getDb();
  const rows = await db.execute<{
    id: string;
    token: string;
    display_name: string;
    target_instagram_username_hash: string;
    target_instagram_username_masked: string | null;
    participant_count: number;
    is_creator: boolean;
  }>(sql`
    SELECT
      tc.id,
      tc.token,
      tc.display_name,
      tc.target_instagram_username_hash,
      tc.target_instagram_username_masked,
      (SELECT count(*) FROM challenge_participants x WHERE x.challenge_id = tc.id) AS participant_count,
      (tc.creator_participant_id = ${participantId}) AS is_creator
    FROM target_challenges tc
    WHERE tc.creator_participant_id = ${participantId}
       OR EXISTS (
         SELECT 1 FROM challenge_participants cp
         WHERE cp.challenge_id = tc.id AND cp.participant_id = ${participantId}
       )
    ORDER BY tc.created_at DESC
  `);

  return [...rows].map((row) => ({
    id: row.id,
    token: row.token,
    displayName: row.display_name,
    targetInstagramUsernameHash: row.target_instagram_username_hash,
    targetInstagramUsernameMasked: row.target_instagram_username_masked,
    participantCount: Number(row.participant_count),
    isCreator: row.is_creator,
  }));
}

/**
 * 2026-09-15 — "챌린지 공유하기"가 실제로 공유/복사까지 완료됐을 때
 * `share_count`를 1 증가시킨다(운영자 전용 지표, 공개 API 응답 어디에도
 * 노출하지 않는다 — DB를 직접 조회해야 볼 수 있다).
 *
 * 로그인 여부와 무관하게 호출된다 — `/t/{token}`은 비로그인 방문자도
 * 열 수 있는 공개 화면이고 공유 버튼도 그 상태에서 눌릴 수 있으므로,
 * participantId 없이 token만으로 갱신한다. 존재하지 않는 토큰이면
 * 아무 행도 갱신되지 않고 조용히 끝난다(호출부가 이미 그 화면을 연
 * 사람이므로 토큰은 사실상 항상 유효하다).
 */
export async function incrementChallengeShareCount(token: string): Promise<void> {
  const db = getDb();
  await db
    .update(targetChallenges)
    .set({ shareCount: sql`${targetChallenges.shareCount} + 1` })
    .where(eq(targetChallenges.token, token));
}

/** Path Check 계산에 필요한 전체 정보(내부용) — API 응답에 그대로 내보내지 않는다. */
export async function getChallengeByToken(token: string): Promise<ChallengeDetail | null> {
  const db = getDb();
  const [row] = await db
    .select({
      id: targetChallenges.id,
      displayName: targetChallenges.displayName,
      targetInstagramUsernameHash: targetChallenges.targetInstagramUsernameHash,
      targetInstagramUsernameMasked: targetChallenges.targetInstagramUsernameMasked,
      creatorParticipantId: targetChallenges.creatorParticipantId,
    })
    .from(targetChallenges)
    .where(eq(targetChallenges.token, token))
    .limit(1);

  return row ?? null;
}
