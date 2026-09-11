import { randomBytes } from "node:crypto";
import { and, desc, eq, or } from "drizzle-orm";
import { getDb, pairInvites, pairResults } from "@gai-ara/db";

const INVITE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7일

export interface InviteRecord {
  id: string;
  token: string;
  inviterParticipantId: string;
  recipientParticipantId: string | null;
  status: "pending" | "accepted" | "expired";
  /** inviter 자신만 본다 — recipient에게는 절대 내려주지 않는다. */
  label: string | null;
  /** recipient에게 그대로 보여줘도 되는 공개용 이름 — inviter가 직접 적는다. */
  inviterNickname: string | null;
  expiresAt: Date;
}

export async function createInvite(
  inviterParticipantId: string,
  options?: { label?: string; nickname?: string },
): Promise<InviteRecord> {
  const token = randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

  const db = getDb();
  const [row] = await db
    .insert(pairInvites)
    .values({
      token,
      inviterParticipantId,
      expiresAt,
      label: options?.label?.trim() || null,
      inviterNickname: options?.nickname?.trim() || null,
    })
    .returning();

  return row as InviteRecord;
}

export async function getInviteByToken(token: string): Promise<InviteRecord | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(pairInvites)
    .where(eq(pairInvites.token, token))
    .limit(1);

  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now() && row.status === "pending") {
    return { ...row, status: "expired" } as InviteRecord;
  }
  return row as InviteRecord;
}

/**
 * 초대를 받은 사람이 자기 데이터를 업로드해 참여자가 되면 호출한다.
 * inviter 본인이 자기 링크로 들어온 경우는 accept하지 않는다.
 *
 * UPDATE 자체를 `status = 'pending'` 조건까지 포함해 원자적으로 수행한다.
 * 그냥 읽고(getInviteByToken) 나서 다시 쓰면, 두 사람이 거의 동시에 같은
 * 링크를 accept할 때 나중 요청이 먼저 요청의 recipient를 덮어쓰는 race가
 * 생긴다 — 그 경우 원래 recipient도, 나중에 온 사람도 서로 다른 사람의
 * 결과를 자기 결과로 받아볼 수 있다. 이 조건부 UPDATE가 매칭에 실패하면
 * (이미 다른 사람이 먼저 accept했거나 만료됨) 호출자는 recipient가 되지
 * 못한 것이므로, 현재 DB 상태를 그대로 다시 읽어 반환한다 — 호출자는
 * 반환된 `recipientParticipantId`가 자신의 id와 같은지 확인해야
 * "내가 accept에 성공했는지"를 알 수 있다.
 */
export async function acceptInvite(
  token: string,
  recipientParticipantId: string,
): Promise<InviteRecord | null> {
  const invite = await getInviteByToken(token);
  if (!invite || invite.status !== "pending") return invite;
  if (invite.inviterParticipantId === recipientParticipantId) return invite;

  const db = getDb();
  const [row] = await db
    .update(pairInvites)
    .set({ recipientParticipantId, status: "accepted" })
    .where(and(eq(pairInvites.id, invite.id), eq(pairInvites.status, "pending")))
    .returning();

  return row ? (row as InviteRecord) : await getInviteByToken(token);
}

export async function upsertPairResult(
  pairInviteId: string,
  distance: number | null,
): Promise<void> {
  const db = getDb();
  await db
    .insert(pairResults)
    .values({ pairInviteId, distance })
    .onConflictDoUpdate({
      target: pairResults.pairInviteId,
      set: { distance, computedAt: new Date() },
    });
}

export interface MyPairSummary {
  token: string;
  role: "inviter" | "recipient";
  /** inviter 자신에게만 채워진다 — recipient 쪽 행에서는 항상 null. */
  label: string | null;
  /** inviter가 공개로 적은 이름 — 양쪽 다 볼 수 있다(recipient는 "누가 보냈는지" 확인용). */
  inviterNickname: string | null;
  status: "pending" | "accepted" | "expired";
  distance: number | null;
  createdAt: Date;
}

/**
 * 이 참여자가 inviter거나 recipient인 초대를 전부, 최신순으로 돌려준다.
 * "내 연결 목록" 화면용 — 링크를 잃어버려도 세션이 살아있는 한 다시 볼 수
 * 있게 한다. 상대방의 신원(해시, participant id 등)은 절대 포함하지 않는다.
 */
export async function listInvitesForParticipant(participantId: string): Promise<MyPairSummary[]> {
  const db = getDb();
  const rows = await db
    .select({
      token: pairInvites.token,
      inviterParticipantId: pairInvites.inviterParticipantId,
      recipientParticipantId: pairInvites.recipientParticipantId,
      status: pairInvites.status,
      label: pairInvites.label,
      inviterNickname: pairInvites.inviterNickname,
      createdAt: pairInvites.createdAt,
      expiresAt: pairInvites.expiresAt,
      distance: pairResults.distance,
    })
    .from(pairInvites)
    .leftJoin(pairResults, eq(pairResults.pairInviteId, pairInvites.id))
    .where(
      or(
        eq(pairInvites.inviterParticipantId, participantId),
        eq(pairInvites.recipientParticipantId, participantId),
      ),
    )
    .orderBy(desc(pairInvites.createdAt));

  const now = Date.now();
  return rows.map((row): MyPairSummary => {
    const role: "inviter" | "recipient" =
      row.inviterParticipantId === participantId ? "inviter" : "recipient";
    const status =
      row.expiresAt.getTime() < now && row.status === "pending" ? "expired" : row.status;

    return {
      token: row.token,
      role,
      label: role === "inviter" ? row.label : null,
      inviterNickname: row.inviterNickname,
      status,
      distance: row.distance,
      createdAt: row.createdAt,
    };
  });
}
