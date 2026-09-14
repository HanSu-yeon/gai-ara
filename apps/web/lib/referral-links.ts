import { randomBytes } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { getDb, participants, referralLinks, referralVisits } from "@gai-ara/db";

export interface ReferralLinkRecord {
  token: string;
}

export interface ReferralVisitRecord {
  nickname: string | null;
  status: "connected" | "unreachable";
  distance: number | null;
}

/** 참여자의 재사용 가능한 링크를 가져오거나(없으면) 만든다. */
export async function getOrCreateReferralLink(
  ownerParticipantId: string,
): Promise<ReferralLinkRecord> {
  const db = getDb();
  const token = randomBytes(16).toString("hex");

  const [row] = await db
    .insert(referralLinks)
    .values({ ownerParticipantId, token })
    .onConflictDoUpdate({
      target: referralLinks.ownerParticipantId,
      set: { ownerParticipantId: sql`${referralLinks.ownerParticipantId}` },
    })
    .returning({ token: referralLinks.token });

  if (!row) throw new Error("referral link upsert returned no row");
  return row;
}

/** 토큰으로 링크가 존재하는지만 확인한다. */
export async function referralLinkExists(token: string): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .select({ token: referralLinks.token })
    .from(referralLinks)
    .where(eq(referralLinks.token, token))
    .limit(1);

  return row !== undefined;
}

/**
 * TASK-003(v2) — 링크가 존재하면 소유자의 표시 이름과 함께 돌려준다.
 * 존재하지 않으면 null. 소유자의 participant id·해시는 절대 포함하지
 * 않는다(v2 명세 §3.3).
 */
export async function getReferralLinkPublicInfo(
  token: string,
): Promise<{ ownerDisplayName: string | null } | null> {
  const db = getDb();
  const [row] = await db
    .select({ ownerDisplayName: participants.displayName })
    .from(referralLinks)
    .innerJoin(participants, eq(participants.id, referralLinks.ownerParticipantId))
    .where(eq(referralLinks.token, token))
    .limit(1);

  return row ?? null;
}

/**
 * 토큰으로 링크 id와 owner의 participant id를 찾는다(내부용) — 방문자와의
 * 거리를 계산하고 방문 기록을 남기려면 필요하다. API 응답에는 절대 그대로
 * 내보내지 않는다, 거리 계산 결과(숫자)만 내보낸다.
 */
export async function getReferralLinkOwner(
  token: string,
): Promise<{ id: string; ownerParticipantId: string } | null> {
  const db = getDb();
  const [row] = await db
    .select({ id: referralLinks.id, ownerParticipantId: referralLinks.ownerParticipantId })
    .from(referralLinks)
    .where(eq(referralLinks.token, token))
    .limit(1);

  return row ?? null;
}

export async function getReferralLinkForParticipant(
  ownerParticipantId: string,
): Promise<ReferralLinkRecord | null> {
  const db = getDb();
  const [row] = await db
    .select({ token: referralLinks.token })
    .from(referralLinks)
    .where(eq(referralLinks.ownerParticipantId, ownerParticipantId))
    .limit(1);

  return row ?? null;
}

/**
 * 방문자가 링크 owner와의 결과를 확인하면, 나중에 owner가 다시 볼 수 있게
 * (링크 id, 방문자 id) 기준으로 upsert한다. 같은 사람이 다시 확인해도 행이
 * 늘어나지 않고 최신 값으로 덮어써진다 — nickname을 이번엔 안 넘겼으면
 * (undefined) 이전에 남긴 닉네임을 그대로 둔다.
 */
export async function recordReferralVisit(
  referralLinkId: string,
  visitorParticipantId: string,
  nickname: string | undefined,
  status: "connected" | "unreachable",
  distance: number | null,
): Promise<void> {
  const db = getDb();
  const trimmedNickname = nickname?.trim() || null;

  await db
    .insert(referralVisits)
    .values({ referralLinkId, visitorParticipantId, nickname: trimmedNickname, status, distance })
    .onConflictDoUpdate({
      target: [referralVisits.referralLinkId, referralVisits.visitorParticipantId],
      set: nickname !== undefined
        ? { nickname: trimmedNickname, status, distance }
        : { status, distance },
    });
}

/** owner가 자기 링크로 들어온 방문자들과의 결과를 최근 순으로 본다. */
export async function getReferralVisitsForOwner(ownerParticipantId: string): Promise<ReferralVisitRecord[]> {
  const db = getDb();
  const rows = await db
    .select({
      nickname: referralVisits.nickname,
      status: referralVisits.status,
      distance: referralVisits.distance,
      createdAt: referralVisits.createdAt,
    })
    .from(referralVisits)
    .innerJoin(referralLinks, eq(referralVisits.referralLinkId, referralLinks.id))
    .where(eq(referralLinks.ownerParticipantId, ownerParticipantId))
    .orderBy(desc(referralVisits.createdAt));

  return rows.map(({ nickname, status, distance }) => ({
    nickname,
    status: status as "connected" | "unreachable",
    distance,
  }));
}

/**
 * `/result`가 "내가 발견한 연결"에 포함할 두 whitelist 중 A방향 —
 * 내가 방문자로서 남의 `/r` 링크를 열어 실제 path를 발견한 owner들.
 * 나는 이미 화면 08에서 그 사람 이름을 봤으므로(그 사람이 자기 링크를
 * 공유하며 스스로 공개한 정보) 새로운 신원 노출이 아니다 — 그래서 별도
 * 동의 없이 항상 포함한다(2026-09-14 결정).
 */
export async function getDiscoveredReferralOwners(visitorParticipantId: string): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .selectDistinct({ ownerParticipantId: referralLinks.ownerParticipantId })
    .from(referralVisits)
    .innerJoin(referralLinks, eq(referralVisits.referralLinkId, referralLinks.id))
    .where(and(eq(referralVisits.visitorParticipantId, visitorParticipantId), eq(referralVisits.status, "connected")));

  return rows.map((row) => row.ownerParticipantId);
}

/**
 * B방향 whitelist — 남이 내 링크를 열어 나와의 연결을 발견했지만, 그
 * 사실만으로는 내 `/result`에 실명으로 나타나지 않는다(2026-09-14 결정:
 * "확인하러 왔다"는 자기 신원을 owner에게 공개하겠다는 동의가 아니다).
 * `revealed_to_owner`가 true인, 즉 방문자가 화면에서 명시적으로 "내 이름
 * 보여주기"를 선택한 행만 돌려준다.
 */
export async function getRevealedReferralVisitors(ownerParticipantId: string): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .select({ visitorParticipantId: referralVisits.visitorParticipantId })
    .from(referralVisits)
    .innerJoin(referralLinks, eq(referralVisits.referralLinkId, referralLinks.id))
    .where(
      and(
        eq(referralLinks.ownerParticipantId, ownerParticipantId),
        eq(referralVisits.status, "connected"),
        eq(referralVisits.revealedToOwner, true),
      ),
    );

  return rows.map((row) => row.visitorParticipantId);
}

/**
 * 방문자 본인이 "내 이름을 링크 주인에게 보여줄까요?"에 명시적으로
 * 동의했을 때만 호출한다 — opt-in이므로 기본값은 항상 false다. 아직
 * `recordReferralVisit`으로 만들어진 행이 없으면(비정상 순서로 호출된
 * 경우) 아무 것도 하지 않는다.
 */
export async function revealVisitToOwner(referralLinkId: string, visitorParticipantId: string): Promise<void> {
  const db = getDb();
  await db
    .update(referralVisits)
    .set({ revealedToOwner: true })
    .where(
      and(
        eq(referralVisits.referralLinkId, referralLinkId),
        eq(referralVisits.visitorParticipantId, visitorParticipantId),
      ),
    );
}
