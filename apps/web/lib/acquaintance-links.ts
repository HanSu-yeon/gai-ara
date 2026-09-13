import { randomBytes } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { getDb, acquaintanceConfirmations, acquaintanceLinks, participants } from "@gai-ara/db";

// 기존 NOT NULL 컬럼과의 호환을 위한 값이다. 링크 유효성 판정에는 사용하지 않는다.
const LEGACY_MAX_USES = 2_147_483_647;
const LEGACY_EXPIRES_AT = new Date("9999-12-31T23:59:59.999Z");

export interface AcquaintanceLinkRecord {
  token: string;
}

export type AcquaintanceLinkStatus = "valid" | "revoked" | "not-found";

export interface AcquaintanceLinkPublicInfo {
  status: AcquaintanceLinkStatus;
  ownerDisplayName: string | null;
}

export type ConfirmAcquaintanceResult =
  | { ok: true }
  | { ok: false; reason: "not-found" | "revoked" | "self" };

/**
 * 호출자의 재사용 지인 링크를 가져오거나 새로 만든다. 폐기되지 않은 기존 링크가
 * 있으면 `revokedAt = now()`로 폐기하고 새로 만든다 —
 * 한 participant는 유효한 링크를 동시에 하나만 가진다(v2 명세 §2.3).
 */
export async function createOrRotateAcquaintanceLink(
  ownerParticipantId: string,
): Promise<AcquaintanceLinkRecord> {
  const db = getDb();
  const token = randomBytes(16).toString("hex");
  return await db.transaction(async (tx) => {
    await tx
      .update(acquaintanceLinks)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(acquaintanceLinks.ownerParticipantId, ownerParticipantId),
          isNull(acquaintanceLinks.revokedAt),
        ),
      );

    const [row] = await tx
      .insert(acquaintanceLinks)
      .values({ token, ownerParticipantId, maxUses: LEGACY_MAX_USES, expiresAt: LEGACY_EXPIRES_AT })
      .returning({ token: acquaintanceLinks.token });
    if (!row) throw new Error("acquaintance link insert returned no row");
    return row;
  });
}

/**
 * 호출자가 지금 갖고 있는 폐기되지 않은 지인 링크를 돌려준다.
 * 없으면 null — v2 명세에는 명시되지 않았지만, 화면 03을 다시 열 때마다
 * `createOrRotateAcquaintanceLink`를 불러 매번 링크를 회전시키면 이미
 * 공유한 링크가 계속 깨지므로, 기존 `GET/POST /api/referral-link` 패턴과
 * 동일하게 "조회는 GET, 회전은 POST"로 나누기 위한 조회 전용 함수다.
 */
export async function getActiveAcquaintanceLinkForOwner(
  ownerParticipantId: string,
): Promise<AcquaintanceLinkRecord | null> {
  const db = getDb();
  const [row] = await db
    .select({ token: acquaintanceLinks.token })
    .from(acquaintanceLinks)
    .where(
      and(
        eq(acquaintanceLinks.ownerParticipantId, ownerParticipantId),
        isNull(acquaintanceLinks.revokedAt),
      ),
    )
    .limit(1);

  if (!row) return null;
  return row;
}

/**
 * 토큰을 연 사람에게 보여줄 최소한의 상태만 반환한다(화면 04). 소유자의
 * participant id·해시는 절대 포함하지 않는다 — 표시 이름만 공개한다.
 */
export async function getAcquaintanceLinkPublicInfo(token: string): Promise<AcquaintanceLinkPublicInfo> {
  const db = getDb();
  const [row] = await db
    .select({
      id: acquaintanceLinks.id,
      revokedAt: acquaintanceLinks.revokedAt,
      ownerDisplayName: participants.displayName,
    })
    .from(acquaintanceLinks)
    .innerJoin(participants, eq(participants.id, acquaintanceLinks.ownerParticipantId))
    .where(eq(acquaintanceLinks.token, token))
    .limit(1);

  if (!row) return { status: "not-found", ownerDisplayName: null };
  if (row.revokedAt) return { status: "revoked", ownerDisplayName: row.ownerDisplayName };

  return { status: "valid", ownerDisplayName: row.ownerDisplayName };
}

/**
 * 화면 04 "네, 알고 있어요"를 눌렀을 때 호출한다. 트랜잭션 안에서 링크
 * 행을 `FOR UPDATE`로 잠가 폐기 확인과 확인 기록 삽입을
 * 하나의 직렬화된 단위로 묶는다 — 짧은 시간에 여러 사람이 동시에 같은
 * 링크를 확인해도 중복 기록이 생기지 않는다.
 *
 * 이미 confirmerParticipantId가 이 링크를 확인한 적이 있으면 재방문·새로고침으로
 * 보고 성공으로 처리한다(멱등, v2 명세 §2.4·§3.2).
 */
export async function confirmAcquaintanceLink(
  token: string,
  confirmerParticipantId: string,
): Promise<ConfirmAcquaintanceResult> {
  const db = getDb();

  return await db.transaction(async (tx) => {
    const [link] = await tx
      .select({
        id: acquaintanceLinks.id,
        ownerParticipantId: acquaintanceLinks.ownerParticipantId,
        revokedAt: acquaintanceLinks.revokedAt,
      })
      .from(acquaintanceLinks)
      .where(eq(acquaintanceLinks.token, token))
      .for("update")
      .limit(1);

    if (!link) return { ok: false, reason: "not-found" };
    if (link.revokedAt) return { ok: false, reason: "revoked" };
    if (link.ownerParticipantId === confirmerParticipantId) return { ok: false, reason: "self" };

    const [already] = await tx
      .select({ id: acquaintanceConfirmations.id })
      .from(acquaintanceConfirmations)
      .where(
        and(
          eq(acquaintanceConfirmations.linkId, link.id),
          eq(acquaintanceConfirmations.confirmerParticipantId, confirmerParticipantId),
        ),
      )
      .limit(1);
    if (already) return { ok: true };

    await tx.insert(acquaintanceConfirmations).values({ linkId: link.id, confirmerParticipantId });
    return { ok: true };
  });
}

export interface ConnectionSummary {
  displayName: string;
  confirmedAt: Date;
}

/**
 * `GET /api/me/connections` — 직접 연결된 상대 목록(표시 이름, 확인
 * 시각). 삭제 기능이 없으므로 제거용 id는 포함하지 않는다(v2 명세 §3.2).
 * 내가 링크 소유자로서 받은 확인과, 내가 남의 링크를 확인한 것 둘 다
 * 포함한다 — 어느 쪽이든 "직접 아는 사이"로 동등하게 취급한다.
 */
export async function listConnectionsForParticipant(participantId: string): Promise<ConnectionSummary[]> {
  const db = getDb();
  const result = await db.execute<{ displayName: string | null; confirmedAt: Date }>(sql`
    SELECT * FROM (
      SELECT p.display_name AS "displayName", ac.confirmed_at AS "confirmedAt"
      FROM acquaintance_confirmations ac
      JOIN acquaintance_links al ON al.id = ac.link_id
      JOIN participants p ON p.id = ac.confirmer_participant_id
      WHERE al.owner_participant_id = ${participantId}
      UNION ALL
      SELECT p.display_name AS "displayName", ac.confirmed_at AS "confirmedAt"
      FROM acquaintance_confirmations ac
      JOIN acquaintance_links al ON al.id = ac.link_id
      JOIN participants p ON p.id = al.owner_participant_id
      WHERE ac.confirmer_participant_id = ${participantId}
    ) combined
    ORDER BY "confirmedAt" DESC
  `);

  return [...result].map((row) => ({
    displayName: row.displayName ?? "이름 미설정",
    confirmedAt: new Date(row.confirmedAt),
  }));
}
