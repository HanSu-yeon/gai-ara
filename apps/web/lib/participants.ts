import { eq, sql } from "drizzle-orm";
import { getDb, follows, participants } from "@gai-ara/db";

/** identityHash로 참여자를 upsert하고 항상 id를 돌려준다. */
export async function upsertParticipant(identityHash: string): Promise<string> {
  const db = getDb();
  const [row] = await db
    .insert(participants)
    .values({ identityHash })
    .onConflictDoUpdate({
      target: participants.identityHash,
      // 값 변경 없이 RETURNING을 받기 위한 no-op 업데이트
      set: { identityHash: sql`excluded.identity_hash` },
    })
    .returning({ id: participants.id });

  if (!row) throw new Error("participant upsert returned no row");
  return row.id;
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
