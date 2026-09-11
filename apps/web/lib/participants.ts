import { randomBytes } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { getDb, follows, participants } from "@gai-ara/db";

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
 * 확정된(mutual) edge만 돌려준다: A가 B를 팔로우한다고 신고했고, B도 참여자로
 * 존재하면서 A를 팔로우한다고 신고했을 때만 A-B를 edge로 인정한다 — 한쪽만
 * 신고한 관계(아직 상대가 참여 안 했거나, 참여했어도 맞팔이 아닌 경우)는
 * 그래프에 전혀 나타나지 않는다. 이게 이 서비스의 그래프가
 * "가이 알아?에 실제로 참여한 사람들 사이의 확인된 맞팔"만 담는 이유다.
 */
export async function getAllEdges(): Promise<Array<{ a: string; b: string }>> {
  const db = getDb();
  const result = await db.execute<{ a: string; b: string }>(sql`
    SELECT DISTINCT f1.follower_participant_id AS a, p2.id AS b
    FROM follows f1
    JOIN participants p1 ON p1.id = f1.follower_participant_id
    JOIN participants p2 ON p2.identity_hash = f1.followee_identity_hash
    JOIN follows f2 ON f2.follower_participant_id = p2.id
      AND f2.followee_identity_hash = p1.identity_hash
    WHERE f1.follower_participant_id < p2.id
  `);
  return [...result].map((row) => ({ a: row.a, b: row.b }));
}
