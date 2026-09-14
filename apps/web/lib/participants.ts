import { randomBytes } from "node:crypto";
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { getDb, follows, oauthAccounts, participants } from "@gai-ara/db";

/**
 * identityHash로 참여자를 upsert하고 id와 recoveryToken을 돌려준다.
 * recoveryToken은 최초 생성 시 한 번만 발급하고, 재업로드(이미 있는
 * identityHash)에는 그대로 유지한다 — 세션 쿠키가 지워져도 이 값으로
 * "내 결과"를 다시 찾아올 수 있다(§ /result/[token]).
 */
export async function upsertParticipant(identityHash: string): Promise<{ id: string; recoveryToken: string }> {
  const db = getDb();
  const recoveryToken = randomBytes(16).toString("hex");

  const [row] = await db
    .insert(participants)
    .values({ identityHash, recoveryToken })
    .onConflictDoUpdate({
      target: participants.identityHash,
      // recoveryToken은 기존 값을 유지한다 — 새로 생성한 값으로 덮어쓰지 않는다.
      set: { identityHash: sql`excluded.identity_hash` },
    })
    .returning({ id: participants.id, recoveryToken: participants.recoveryToken });

  if (!row) throw new Error("participant upsert returned no row");
  return row;
}

/**
 * Instagram 없이 지인 확인 링크(화면 04)만으로 처음 참여하는 사람을 위한
 * 최소 부트스트랩. 이름/닉네임/프로필 사진 등 어떤 식별 정보도 받지 않고
 * 참여자 row 하나만 새로 만든다 — identityHash는 매칭에 쓰지 않는 순수
 * opaque 값이라 upsert가 아니라 항상 새 행을 만든다(재호출 시 참여자가
 * 중복 생성되지 않도록 호출 쪽(`getSessionParticipantId`)에서 이미 세션이
 * 있으면 아예 호출하지 않는다).
 */
export async function createBootstrapParticipant(): Promise<{ id: string; recoveryToken: string }> {
  const db = getDb();
  const identityHash = `bootstrap:${randomBytes(32).toString("hex")}`;
  const recoveryToken = randomBytes(16).toString("hex");

  const [row] = await db
    .insert(participants)
    .values({ identityHash, recoveryToken })
    .returning({ id: participants.id, recoveryToken: participants.recoveryToken });

  if (!row) throw new Error("bootstrap participant insert returned no row");
  return row;
}

/**
 * TASK-003(v2) — 카카오 로그인 콜백에서 호출한다. `(provider, providerAccountId)`로
 * 동일인을 판별한다 — 있으면 그 participantId를 그대로 돌려주고, 없으면 새
 * participants 행을 만든다. 새로 만드는 participants 행의 identityHash는
 * `createBootstrapParticipant()`와 같은 컨벤션으로 `kakao:<random hex>` opaque
 * 값을 채운다 — 매칭에는 쓰이지 않고 NOT NULL/UNIQUE 제약을 만족시키기 위한
 * 자리채움일 뿐이다(TASK-003 백로그 Implementation Preconditions 참고).
 *
 * 두 로그인 요청이 거의 동시에 들어오는 race에서는 이론적으로 participants
 * 행이 중복 생성될 수 있다(oauth_accounts 유니크 제약에 걸린 쪽은 새로 만든
 * participants 행이 고아로 남는다) — `acceptInvite`/`createBootstrapParticipant`와
 * 같은 수준의 기존 제약이며, 이번 작업이 새로 만드는 리스크는 아니다.
 */
export async function findOrCreateKakaoParticipant(providerAccountId: string): Promise<string> {
  const db = getDb();

  const [existing] = await db
    .select({ participantId: oauthAccounts.participantId })
    .from(oauthAccounts)
    .where(and(eq(oauthAccounts.provider, "kakao"), eq(oauthAccounts.providerAccountId, providerAccountId)))
    .limit(1);
  if (existing) return existing.participantId;

  return await db.transaction(async (tx) => {
    const identityHash = `kakao:${randomBytes(32).toString("hex")}`;
    const recoveryToken = randomBytes(16).toString("hex");

    const [participant] = await tx
      .insert(participants)
      .values({ identityHash, recoveryToken })
      .returning({ id: participants.id });
    if (!participant) throw new Error("kakao participant insert returned no row");

    const [inserted] = await tx
      .insert(oauthAccounts)
      .values({ participantId: participant.id, provider: "kakao", providerAccountId })
      .onConflictDoNothing()
      .returning({ participantId: oauthAccounts.participantId });
    if (inserted) return inserted.participantId;

    // 충돌(다른 요청이 먼저 같은 providerAccountId를 등록함) — 그 쪽이 정본이다.
    const [winner] = await tx
      .select({ participantId: oauthAccounts.participantId })
      .from(oauthAccounts)
      .where(and(eq(oauthAccounts.provider, "kakao"), eq(oauthAccounts.providerAccountId, providerAccountId)))
      .limit(1);
    if (!winner) throw new Error("oauth account conflict but no winning row found");
    return winner.participantId;
  });
}

/** 표시 이름을 가져온다 — 아직 설정하지 않았으면 null. */
export async function getDisplayName(participantId: string): Promise<string | null> {
  const db = getDb();
  const [row] = await db
    .select({ displayName: participants.displayName })
    .from(participants)
    .where(eq(participants.id, participantId))
    .limit(1);
  return row?.displayName ?? null;
}

/**
 * 표시 이름을 설정/변경한다. 로그인 프로필에서 자동으로 채우지 않고
 * 사용자가 직접 입력한 값만 저장한다(결정 로그 2026-09-13 항목 8) — 이
 * 함수를 호출하는 쪽(`PATCH /api/me/display-name`)에서 이미 트림·빈 문자열
 * 검증을 마친 값만 넘겨준다.
 *
 * 2026-09-15 "마지막 연결자 공개" 결정 — **표시 이름을 처음 설정하는
 * 순간에만** `publicConnectorNameConsentAt`을 함께 채운다. 지금 이
 * 함수의 유일한 호출부(화면 02, `LoginScreen`의 "needs-name" 상태)는
 * "길의 마지막 연결자가 되면 이 이름이 챌린지에 표시될 수 있어요"라는
 * 고지를 보여준 뒤에만 제출을 받으므로, 최초 제출 = 동의로 본다. 이미
 * displayName이 있는 상태에서 이 함수가 다시 호출돼도(지금 UI에는 그런
 * 경로가 없다) 이 동의 시각은 건드리지 않는다 — 그 시점에 고지를 다시
 * 봤다는 보장이 없기 때문이다. `display_name IS NULL`(변경 전 값) 조건으로
 * 판단해야 하므로 Drizzle의 단순 `.set()`이 아니라 조건부 `CASE` 표현식을
 * 쓴다 — 이 UPDATE 문 안에서 "변경 전 값"과 "변경 후 값"을 동시에 참조할
 * 수 있는 유일한 방법이다.
 */
export async function setDisplayName(participantId: string, displayName: string): Promise<void> {
  const db = getDb();
  await db.execute(sql`
    UPDATE participants
    SET display_name = ${displayName},
        public_connector_name_consent_at = CASE
          WHEN display_name IS NULL THEN now()
          ELSE public_connector_name_consent_at
        END
    WHERE id = ${participantId}
  `);
}

/**
 * 2026-09-15 "마지막 연결자 공개" 결정 — 주어진 participant id 목록 중,
 * 공개 동의(`publicConnectorNameConsentAt IS NOT NULL`)가 된 사람들의
 * displayName만 돌려준다. 동의하지 않은 사람은 이 목록에 아예 나타나지
 * 않는다 — 호출부가 "누가 동의를 안 했는지" id 단위로는 알 수 없고,
 * "몇 명이 동의했는지"는 반환된 배열 길이로만 알 수 있다(참여자 id 자체를
 * 클라이언트로 보내지 않기 위한 설계, `apps/web/lib/graph-service.ts`의
 * `computeChallengePublicResult` 참고).
 */
export async function getConsentedDisplayNames(participantIds: string[]): Promise<string[]> {
  if (participantIds.length === 0) return [];
  const db = getDb();
  const rows = await db
    .select({ displayName: participants.displayName })
    .from(participants)
    .where(and(inArray(participants.id, participantIds), isNotNull(participants.publicConnectorNameConsentAt)))
    .orderBy(participants.id); // 매 호출마다 순서가 흔들리지 않도록 결정적으로 정렬한다.
  return rows.map((row) => row.displayName).filter((name): name is string => name !== null);
}

/** 복구 토큰으로 participantId를 찾는다. 없으면 null. */
export async function getParticipantIdByRecoveryToken(recoveryToken: string): Promise<string | null> {
  const db = getDb();
  const [row] = await db
    .select({ id: participants.id })
    .from(participants)
    .where(eq(participants.recoveryToken, recoveryToken))
    .limit(1);
  return row?.id ?? null;
}

/** participantId로 복구 토큰을 가져온다 — "내 결과 저장 링크"를 보여줄 때 쓴다. */
export async function getRecoveryToken(participantId: string): Promise<string | null> {
  const db = getDb();
  const [row] = await db
    .select({ recoveryToken: participants.recoveryToken })
    .from(participants)
    .where(eq(participants.id, participantId))
    .limit(1);
  return row?.recoveryToken ?? null;
}

export async function participantExists(id: string): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .select({ id: participants.id })
    .from(participants)
    .where(eq(participants.id, id))
    .limit(1);
  return Boolean(row);
}

/**
 * 2026-09-14 Instagram import 재도입 — selfId(참여자)의 Instagram 맞팔
 * 목록(`@gai-ara/ig-parser`의 `computeMutuals`로 이미 교집합까지 끝낸
 * 결과)을 현재 상태와 동기화한다. 단순 추가가 아니라 없어진 건 지우고
 * 새로 생긴 건 추가한다 — 재업로드 시 이전 맞팔 중 더 이상 맞팔이 아닌
 * 사람은 이 소스에서 사라져야 하기 때문이다(§7). `acquaintance_confirmations`
 * 는 완전히 별개 테이블이라 여기서 지우는 행이 confirmed 관계에 영향을
 * 주지 않는다.
 *
 * mutualUsernameHashes는 상대가 아직 참여했는지, 자기 인스타 계정을
 * 연동했는지와 무관하게 전부 저장한다(나중에 연동하면 바로 대조 가능해야
 * 하므로). 실제 edge로 이어지는지는 `getAllEdges`가 읽을 때
 * `participants.instagramUsernameHash`와 대조해서 판정한다.
 */
export async function syncInstagramMutuals(
  selfId: string,
  mutualUsernameHashes: string[],
): Promise<void> {
  const db = getDb();
  const unique = [...new Set(mutualUsernameHashes)];

  await db.transaction(async (tx) => {
    await tx.delete(follows).where(eq(follows.followerParticipantId, selfId));
    if (unique.length > 0) {
      await tx
        .insert(follows)
        .values(unique.map((followeeIdentityHash) => ({ followerParticipantId: selfId, followeeIdentityHash })))
        .onConflictDoNothing();
    }
  });
}

/**
 * 본인이 직접 확인한 자기 Instagram 계정의 해시를 등록한다(§4 — 로그인
 * 수단이 아니라 맞팔 대조용 신원 확인). 이미 다른 참여자가 같은 해시를
 * 등록했다면(유니크 제약 위반) false를 돌려주고 아무것도 바꾸지 않는다 —
 * 계정 하나가 두 참여자에게 동시에 매칭되는 걸 막기 위함이다. 재연동
 * (같은 사람이 다시 업로드)은 정상적으로 덮어써야 하므로, 먼저 자기
 * 자신에게 이미 그 해시가 있는지 확인해 조용히 성공 처리한다.
 */
export async function claimInstagramUsername(
  participantId: string,
  usernameHash: string,
): Promise<boolean> {
  const db = getDb();
  try {
    await db.update(participants).set({ instagramUsernameHash: usernameHash }).where(eq(participants.id, participantId));
    return true;
  } catch (error) {
    if (error instanceof Error && /instagram_username_hash/.test(error.message)) return false;
    throw error;
  }
}

/**
 * 2026-09-14 타겟 챌린지 — 대상 Instagram 해시가 실제 참여자의 것이면
 * 그 participantId를 돌려준다(대상이 이미 가입해서 자기 계정을 연동한
 * 경우). 없으면 null — 아직 참여자가 아니거나 연동 전이라는 뜻이다.
 */
export async function getParticipantIdByInstagramHash(usernameHash: string): Promise<string | null> {
  const db = getDb();
  const [row] = await db
    .select({ id: participants.id })
    .from(participants)
    .where(eq(participants.instagramUsernameHash, usernameHash))
    .limit(1);
  return row?.id ?? null;
}

/**
 * 2026-09-14 타겟 챌린지 — 대상이 아직 참여자가 아닐 때, 그 대상을 자기
 * 맞팔 목록에 올려둔(즉 실제로 그 사람과 서로 팔로우하는) 실제 참여자
 * 후보들을 돌려준다. 이 중 뷰어에게 가장 가까운 후보를 거쳐 대상까지
 * +1 거리로 계산한다(`graph-service.ts`의 `computeChallengeResult`).
 */
export async function getParticipantIdsFollowingInstagramHash(usernameHash: string): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .selectDistinct({ id: follows.followerParticipantId })
    .from(follows)
    .where(eq(follows.followeeIdentityHash, usernameHash));
  return rows.map((row) => row.id);
}

/**
 * TASK-002 시절 edge 소스였던 쿼리. TASK-003(v2) 이후로는 `getAllEdges`가
 * 이 쿼리를 더 이상 호출하지 않는다 — `pair_invites`가 만든 accepted 행은
 * 그래프 계산에 관여하지 않는다(v2 명세 §2.4). `follows`와 같은 취급으로
 * 코드/스키마 모두 삭제하지 않고 보존한다 — 지금 당장 쓰이지 않을 뿐,
 * 삭제하면 나중에 1:1 링크(`/pair/[token]`, `/api/invites/*`)를 다시 쓰고
 * 싶을 때 처음부터 다시 만들어야 한다.
 */
async function getLegacyPairInviteEdges(): Promise<Array<{ a: string; b: string }>> {
  const db = getDb();
  const result = await db.execute<{ a: string; b: string }>(sql`
    SELECT DISTINCT
      LEAST(inviter_participant_id, recipient_participant_id) AS a,
      GREATEST(inviter_participant_id, recipient_participant_id) AS b
    FROM pair_invites
    WHERE status = 'accepted' AND recipient_participant_id IS NOT NULL
  `);
  return [...result].map((row) => ({ a: row.a, b: row.b }));
}

/**
 * 확정된 edge를 전부 돌려준다. 두 소스를 합친다(2026-09-14 Instagram
 * import 재도입 결정, MVP에서는 두 source를 shortest path 계산에서
 * 구분하지 않고 동일하게 취급한다):
 *
 * 1. `invite_confirmed` — `acquaintance_confirmations`의 모든 행. 지인
 *    링크 수신자가 "실제로 아는 사이인가요?"에 "네"라고 확인한 순간
 *    (`confirmAcquaintanceLink`) (링크 소유자, 확인한 사람) 쌍이 edge가
 *    된다(v2 명세 §2.4).
 * 2. `instagram_mutual` — `follows`(내 맞팔 목록)의 행 중, 그 상대의
 *    Instagram 해시가 실제 참여자의 `instagramUsernameHash`와 일치하는
 *    경우만 edge가 된다. 상대가 아직 인스타 연동 전이면(해시가 어떤
 *    참여자와도 안 맞으면) edge가 생기지 않는다 — 나중에 연동하면 재계산
 *    시 자동으로 나타난다. `follows` 쪽만 확인하면 충분하다(맞팔은 한쪽
 *    export만으로도 이미 양방향 사실이므로, 상대가 반대 방향 행을 올릴
 *    때까지 기다릴 필요가 없다 — participant-only 모델 시절과 다른 점).
 *
 * 두 source는 각각 다른 테이블에서만 나오므로, edge에 별도 source 컬럼을
 * 추가하지 않아도 "어느 테이블에서 왔는지"로 이미 구분된다 — 이 함수를
 * 호출하는 쪽(BFS)은 어차피 구분하지 않으므로 지금은 이걸로 충분하다.
 *
 * `pair_invites` 기반 1회용 edge 소스(`getLegacyPairInviteEdges`)는
 * 코드/스키마 모두 삭제하지 않고 그대로 남아 있지만, 이 함수는 조회하지
 * 않는다.
 */
export async function getAllEdges(): Promise<Array<{ a: string; b: string }>> {
  const db = getDb();
  const result = await db.execute<{ a: string; b: string }>(sql`
    SELECT DISTINCT a, b FROM (
      SELECT
        LEAST(al.owner_participant_id, ac.confirmer_participant_id) AS a,
        GREATEST(al.owner_participant_id, ac.confirmer_participant_id) AS b
      FROM acquaintance_confirmations ac
      JOIN acquaintance_links al ON al.id = ac.link_id
      UNION
      SELECT
        LEAST(f.follower_participant_id, p.id) AS a,
        GREATEST(f.follower_participant_id, p.id) AS b
      FROM follows f
      JOIN participants p ON p.instagram_username_hash = f.followee_identity_hash
      WHERE p.id != f.follower_participant_id
    ) edges
  `);
  return [...result].map((row) => ({ a: row.a, b: row.b }));
}

/**
 * 이 참여자가 확정된 관계를 하나라도 갖고 있는지("edge가 0개인 신규
 * 참여자인지")만 저렴하게 확인한다 — `/r/{token}` path-not-found 화면이
 * "아직 내 그래프가 시작 안 됨"과 "그래프는 있지만 이 상대까지는 아직
 * 못 닿음"을 구분해서 보여주기 위해 쓴다(2026-09-14 결정).
 */
export async function hasAnyConfirmedConnection(participantId: string): Promise<boolean> {
  const db = getDb();
  const result = await db.execute<{ exists: boolean }>(sql`
    SELECT EXISTS (
      SELECT 1 FROM acquaintance_confirmations ac
      JOIN acquaintance_links al ON al.id = ac.link_id
      WHERE al.owner_participant_id = ${participantId} OR ac.confirmer_participant_id = ${participantId}
    ) AS exists
  `);
  return [...result][0]?.exists ?? false;
}
