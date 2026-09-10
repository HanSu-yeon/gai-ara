import { eq, sql } from "drizzle-orm";
import { getDb, participants, relationships } from "@gai-ara/db";

/**
 * identityHash로 참여자를 upsert하고 항상 id를 돌려준다.
 * `hasUploadedOwnData`는 true로만 승격하고 절대 false로 되돌리지 않는다
 * (한 번 직접 참여한 사람이 나중에 다른 사람의 맞팔 목록에 다시 등장해도
 * 참여 여부가 취소되면 안 되므로).
 */
export async function upsertParticipant(
  identityHash: string,
  { hasUploadedOwnData }: { hasUploadedOwnData: boolean },
): Promise<string> {
  const db = getDb();
  const [row] = await db
    .insert(participants)
    .values({ identityHash, hasUploadedOwnData })
    .onConflictDoUpdate({
      target: participants.identityHash,
      set: hasUploadedOwnData
        ? { hasUploadedOwnData: true }
        // 값 변경 없이 RETURNING을 받기 위한 no-op 업데이트
        : { identityHash: sql`${participants.identityHash}` },
    })
    .returning({ id: participants.id });

  if (!row) throw new Error("participant upsert returned no row");
  return row.id;
}

export async function getParticipantTotalCount(): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(participants);
  return row?.count ?? 0;
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
 * 다른 참여자의 맞팔 목록에만 등장하는 "고스트" 참여자들을 한 번에 upsert한다.
 * N개의 mutual을 순차 upsert하면 업로드마다 N번의 왕복이 생기므로,
 * 한 번의 batch insert + RETURNING으로 처리한다.
 */
export async function upsertGhostParticipantsBatch(
  identityHashes: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(identityHashes)];
  if (unique.length === 0) return new Map();

  const db = getDb();
  const rows = await db
    .insert(participants)
    .values(unique.map((identityHash) => ({ identityHash, hasUploadedOwnData: false })))
    .onConflictDoUpdate({
      target: participants.identityHash,
      // 값은 바꾸지 않고 기존 행의 id를 RETURNING으로 받기 위한 no-op 업데이트
      set: { identityHash: sql`excluded.identity_hash` },
    })
    .returning({ id: participants.id, identityHash: participants.identityHash });

  return new Map(rows.map((row) => [row.identityHash, row.id]));
}

export async function createMutualEdgesBatch(pairs: Array<[string, string]>): Promise<void> {
  const values = pairs
    .filter(([a, b]) => a !== b)
    .map(([a, b]) => (a < b ? { participantAId: a, participantBId: b } : { participantAId: b, participantBId: a }));

  if (values.length === 0) return;

  const db = getDb();
  await db.insert(relationships).values(values).onConflictDoNothing();
}

export async function getAllEdges(): Promise<Array<{ a: string; b: string }>> {
  const db = getDb();
  const rows = await db
    .select({ a: relationships.participantAId, b: relationships.participantBId })
    .from(relationships);
  return rows;
}
