import { randomBytes } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
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
 */
export async function setDisplayName(participantId: string, displayName: string): Promise<void> {
  const db = getDb();
  await db.update(participants).set({ displayName }).where(eq(participants.id, participantId));
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
 * selfId(참여자)가 신고한 "내가 팔로우하는 사람" 목록을 현재 상태와
 * 동기화한다 — 단순 추가가 아니라 없어진 건 지우고 새로 생긴 건 추가한다.
 * followeeIdentityHashes는 그 사람이 아직 참여했는지 여부와 무관하게 전부
 * 저장한다(아직 참여 안 했어도 나중에 참여하면 바로 대조할 수 있어야
 * 하므로). mutual 여부 판정은 여기서 하지 않는다 — `getAllEdges`가 읽을 때
 * 양방향을 대조해서 판정한다.
 */
export async function syncFollowingBatch(
  selfId: string,
  followeeIdentityHashes: string[],
): Promise<void> {
  const db = getDb();
  const unique = [...new Set(followeeIdentityHashes)];

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
 * 확정된 edge를 전부 돌려준다. TASK-003(v2) 이후 유일한 edge 소스는
 * `acquaintance_confirmations`의 모든 행이다 — 지인 링크 수신자가 "실제로
 * 아는 사이인가요?"에 "네"라고 확인한 순간(`confirmAcquaintanceLink`)
 * (링크 소유자, 확인한 사람) 쌍이 곧 edge가 된다(v2 명세 §2.4).
 *
 * `pair_invites` 기반 1회용 edge 소스(`getLegacyPairInviteEdges`)와
 * `follows`(Instagram 맞팔 자기 신고)는 코드/스키마 모두 삭제하지 않고
 * 그대로 남아 있지만, 이 함수는 둘 다 조회하지 않는다 — 즉 그 두 테이블에만
 * 있는 관계는 그래프 계산에 전혀 관여하지 않는다.
 */
export async function getAllEdges(): Promise<Array<{ a: string; b: string }>> {
  const db = getDb();
  const result = await db.execute<{ a: string; b: string }>(sql`
    SELECT DISTINCT
      LEAST(al.owner_participant_id, ac.confirmer_participant_id) AS a,
      GREATEST(al.owner_participant_id, ac.confirmer_participant_id) AS b
    FROM acquaintance_confirmations ac
    JOIN acquaintance_links al ON al.id = ac.link_id
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
