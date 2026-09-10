import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb, pairInvites, pairResults } from "@gai-ara/db";

const INVITE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7일

export interface InviteRecord {
  id: string;
  token: string;
  inviterParticipantId: string;
  recipientParticipantId: string | null;
  status: "pending" | "accepted" | "expired";
  expiresAt: Date;
}

export async function createInvite(inviterParticipantId: string): Promise<InviteRecord> {
  const token = randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

  const db = getDb();
  const [row] = await db
    .insert(pairInvites)
    .values({ token, inviterParticipantId, expiresAt })
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
    .where(eq(pairInvites.id, invite.id))
    .returning();

  return row as InviteRecord;
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
