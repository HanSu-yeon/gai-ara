import { randomBytes } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { getDb, referralLinks } from "@gai-ara/db";

export interface ReferralLinkRecord {
  token: string;
  nickname: string | null;
  visitCount: number;
}

/**
 * 참여자의 재사용 가능한 소개 링크를 가져오거나(없으면) 만든다.
 * nickname을 넘기면 기존 링크의 닉네임도 갱신한다 — 생략하면 그대로 둔다.
 */
export async function getOrCreateReferralLink(
  ownerParticipantId: string,
  nickname?: string,
): Promise<ReferralLinkRecord> {
  const db = getDb();
  const token = randomBytes(16).toString("hex");
  const trimmedNickname = nickname?.trim() || null;

  const [row] = await db
    .insert(referralLinks)
    .values({ ownerParticipantId, token, nickname: trimmedNickname })
    .onConflictDoUpdate({
      target: referralLinks.ownerParticipantId,
      // nickname을 새로 안 넘겼으면(undefined) 기존 값을 유지한다.
      set: nickname !== undefined
        ? { nickname: trimmedNickname }
        : { ownerParticipantId: sql`${referralLinks.ownerParticipantId}` },
    })
    .returning({ token: referralLinks.token, nickname: referralLinks.nickname, visitCount: referralLinks.visitCount });

  if (!row) throw new Error("referral link upsert returned no row");
  return row;
}

/**
 * 토큰으로 소개 링크를 찾고, 방문 횟수를 1 늘린다. 익명 카운트만 늘릴 뿐
 * "누가" 방문했는지는 어디에도 남기지 않는다. owner의 신원(해시, id)도
 * 절대 반환하지 않는다 — nickname만 방문자에게 보여줄 수 있다.
 */
export async function visitReferralLink(token: string): Promise<{ nickname: string | null } | null> {
  const db = getDb();
  const [row] = await db
    .update(referralLinks)
    .set({ visitCount: sql`${referralLinks.visitCount} + 1` })
    .where(eq(referralLinks.token, token))
    .returning({ nickname: referralLinks.nickname });

  return row ?? null;
}

/**
 * 토큰으로 owner의 participant id를 찾는다(내부용) — 방문자와의 거리를
 * 계산하려면 필요하다. API 응답에는 절대 그대로 내보내지 않는다, 거리
 * 계산 결과(숫자)만 내보낸다.
 */
export async function getReferralLinkOwner(token: string): Promise<string | null> {
  const db = getDb();
  const [row] = await db
    .select({ ownerParticipantId: referralLinks.ownerParticipantId })
    .from(referralLinks)
    .where(eq(referralLinks.token, token))
    .limit(1);

  return row?.ownerParticipantId ?? null;
}

export async function getReferralLinkForParticipant(
  ownerParticipantId: string,
): Promise<ReferralLinkRecord | null> {
  const db = getDb();
  const [row] = await db
    .select({ token: referralLinks.token, nickname: referralLinks.nickname, visitCount: referralLinks.visitCount })
    .from(referralLinks)
    .where(eq(referralLinks.ownerParticipantId, ownerParticipantId))
    .limit(1);

  return row ?? null;
}
