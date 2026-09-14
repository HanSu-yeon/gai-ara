import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * 참여자. Instagram username은 절대 평문으로 저장하지 않는다.
 * identityHash = HMAC_SHA256(normalize(username), IDENTITY_PEPPER)
 * (packages/db는 이 해시를 어떻게 만드는지 모른다 — 해싱은 apps/web의
 * 서버 전용 코드에서만 IDENTITY_PEPPER를 사용해 수행한다.)
 *
 * Instagram 없이 지인 확인 링크(pair_invites)만으로 참여하는 사람은 매칭에
 * 쓸 username이 없으므로, identityHash 자리에 무작위 불투명 값(예:
 * `bootstrap:<random hex>`)을 대신 채운다 — 이 값은 어떤 실제 계정과도
 * 매칭되지 않는 순수 opaque id로만 쓰인다(apps/web의 참여자 생성 로직 참고).
 *
 * "고스트" 노드는 없다 — 이 테이블은 실제로 자기 데이터를 업로드했거나
 * 최소 부트스트랩으로 참여를 확정한 사람만 담는다(participant-only 그래프).
 * 누군가의 following 목록에만 등장하고 아직 업로드하지 않은 사람은
 * `follows.followee_identity_hash`에 해시만 남고, 이 테이블에는 그 사람이
 * 직접 참여하기 전까지 행이 생기지 않는다.
 *
 * recoveryToken: 세션 쿠키가 지워지거나(시크릿 모드, 다른 기기, 쿠키 삭제)
 * DB가 초기화돼도 "내 결과"로 돌아올 수 있게 하는 개인용 복구 링크 값.
 * 참가자 최초 생성 시 한 번 발급되고 재업로드해도 그대로 유지된다 —
 * referralLinks.token과 달리 이건 아무에게도 공유되지 않고 본인만 안다는
 * 전제로 세션 대신 쓸 수 있다(§ /result/[token]).
 *
 * displayName: TASK-003(v2)부터 추가. 로그인 프로필(카카오 닉네임 등)에서
 * 자동으로 채우지 않고, 사용자가 화면 02에서 직접 입력한 값만 담는다(과거
 * 행/Instagram 참여자는 NULL). 직접 연결된 상대의 화면, 본인 화면, 본인이
 * 만든 공개 링크 결과에서만 노출한다 — 검색·임의 조회에는 쓰지 않는다
 * (`AGENTS.md` §1 원칙 3).
 */
export const participants = pgTable("participants", {
  id: uuid("id").defaultRandom().primaryKey(),
  identityHash: text("identity_hash").notNull(),
  recoveryToken: text("recovery_token").notNull(),
  displayName: text("display_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  identityHashUnique: uniqueIndex("participants_identity_hash_key").on(table.identityHash),
  recoveryTokenUnique: uniqueIndex("participants_recovery_token_key").on(table.recoveryToken),
}));

/**
 * TASK-003(v2) — 카카오 로그인으로 동일 사용자를 판별하는 조인 테이블.
 * `(provider, providerAccountId)`가 실제 동일인 판정의 근거다 —
 * `participants.identityHash`는 카카오 참여자에게는 `kakao:<random hex>`
 * 자리채움 값일 뿐 매칭에 쓰이지 않는다(apps/web/lib/participants.ts의
 * `findOrCreateKakaoParticipant` 참고). provider는 지금은 'kakao' 고정값
 * 하나뿐이다(결정 로그 2026-09-13 항목 7 — 다른 제공자는 추가하지 않음).
 */
export const oauthAccounts = pgTable("oauth_accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  participantId: uuid("participant_id")
    .notNull()
    .references(() => participants.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  providerAccountUnique: uniqueIndex("oauth_accounts_provider_account_key").on(
    table.provider,
    table.providerAccountId,
  ),
}));

/** 로그인 없이 "내 결과 다시 보기"를 지원하기 위한 최소한의 세션. */
export const sessions = pgTable("sessions", {
  token: text("token").primaryKey(),
  participantId: uuid("participant_id")
    .notNull()
    .references(() => participants.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

/**
 * 참여자 한 명이 자기 following.json에서 신고한 "나는 이 사람을 팔로우한다"는
 * 방향성 있는 주장. 이것만으로는 맞팔(mutual)이 아니다 — followee 쪽도
 * 참여해서 반대 방향 행을 올려야, 그 둘을 대조해서 mutual edge로 인정한다
 * (§4 참고). followeeIdentityHash는 FK가 아니다 — 아직 참여하지 않은
 * 사람의 해시를 미리 담아둘 수 있어야, 그 사람이 나중에 참여했을 때
 * 곧바로 대조가 가능하다.
 */
export const follows = pgTable("follows", {
  id: uuid("id").defaultRandom().primaryKey(),
  followerParticipantId: uuid("follower_participant_id")
    .notNull()
    .references(() => participants.id, { onDelete: "cascade" }),
  followeeIdentityHash: text("followee_identity_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  pairUnique: uniqueIndex("follows_pair_key").on(
    table.followerParticipantId,
    table.followeeIdentityHash,
  ),
}));

export const pairInviteStatus = ["pending", "accepted", "expired"] as const;
export type PairInviteStatus = (typeof pairInviteStatus)[number];

/**
 * "우리 몇다리?" 공유 링크. token은 추측 불가능한 무작위 값이어야 한다.
 *
 * 2026-09-13 결정 이후: `status = 'accepted'`인 행(inviter, recipient 쌍)
 * 자체가 그래프의 edge 소스다 — 별도 edge 테이블을 두지 않는다. recipient가
 * "실제로 아는 사이인가요?"에 "네"라고 확인해 이 행이 accepted로 바뀌는
 * 순간이 곧 edge 생성 이벤트다(apps/web/lib/participants.ts의 `getAllEdges`
 * 참고). inviter 쪽 재확인은 요구하지 않는다.
 *
 * label: inviter가 "이거 누구한테 보낸 거였지" 기억하려고 붙이는 선택적
 * 메모다. inviter 자신에게만 보인다 — recipient나 다른 누구에게도 절대
 * 노출하지 않는다(상대 신원을 시스템이 아는 게 아니라, inviter가 이미 알고
 * 있는 걸 inviter 본인에게만 다시 보여주는 것뿐이므로 프라이버시 원칙과
 * 충돌하지 않는다).
 *
 * inviterNickname: label과 반대로 recipient에게 보여주려고 inviter가 직접
 * 적는 공개용 이름이다("OO님이 궁금해해요"). 프라이버시 원칙이 막는 건
 * "그래프 안에서 누가 누구와 연결됐는지"(중간 연결자)이지, "누가 이 초대를
 * 보냈는지"가 아니다 — 후자는 어차피 카카오톡/DM으로 링크를 직접 전달받는
 * 순간 recipient가 이미 아는 정보라, 시스템이 별도로 숨길 실익이 없다.
 */
export const pairInvites = pgTable("pair_invites", {
  id: uuid("id").defaultRandom().primaryKey(),
  token: text("token").notNull(),
  inviterParticipantId: uuid("inviter_participant_id")
    .notNull()
    .references(() => participants.id, { onDelete: "cascade" }),
  recipientParticipantId: uuid("recipient_participant_id").references(
    () => participants.id,
    { onDelete: "cascade" },
  ),
  status: text("status", { enum: pairInviteStatus }).notNull().default("pending"),
  label: text("label"),
  inviterNickname: text("inviter_nickname"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, (table) => ({
  tokenUnique: uniqueIndex("pair_invites_token_key").on(table.token),
}));

/**
 * 재사용 가능한 "내 링크" — `pair_invites`와 달리 특정 상대 한 명을
 * 지정하지 않는다. 참여자당 하나만 있고(최초 요청 시 upsert), 여러 사람이
 * 같은 링크로 들어와 각자 `/upload`로 참여할 수 있다. 실제로 서로 맞팔이면
 * 각자 업로드를 마친 뒤 그래프에서 자동으로 연결이 잡힌다(별도 매칭 로직
 * 불필요) — 누가 방문했는지는 `referralVisits`에 남지만, 그 사람들 사이의
 * 중간 연결자는 그래프 계산 자체가 절대 돌려주지 않으므로(§ packages/graph)
 * 이 표와는 별개로 계속 보호된다.
 */
export const referralLinks = pgTable("referral_links", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerParticipantId: uuid("owner_participant_id")
    .notNull()
    .references(() => participants.id, { onDelete: "cascade" }),
  token: text("token").notNull(),
  /** pair_invites의 inviterNickname과 같은 개념 — 방문자에게 그대로 보여준다. */
  nickname: text("nickname"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tokenUnique: uniqueIndex("referral_links_token_key").on(table.token),
  ownerUnique: uniqueIndex("referral_links_owner_key").on(table.ownerParticipantId),
}));

/**
 * 내 링크로 들어와서 업로드까지 마친 방문자 한 명당 한 행. owner가 "누구와
 * 몇 다리인지"를 나중에 다시 볼 수 있게 하는 표 — nickname은 방문자 본인이
 * 선택적으로 남기는 값이고(자기 신원을 owner에게 공개할지는 방문자가
 * 결정), distance/status는 계산 결과다. 같은 방문자가 다시 확인하면
 * (ownerParticipantId, visitorParticipantId) 유니크 제약으로 덮어쓴다 —
 * 방문할 때마다 새 행이 쌓이지 않는다.
 *
 * revealedToOwner: 2026-09-14 결정 — 방문자가 링크를 열어 owner와의 연결을
 * 발견했다는 사실만으로는 owner의 `/result`에 실명 endpoint로 나타나지
 * 않는다(기본값 false, 익명). 방문자가 화면에서 명시적으로 "내 이름
 * 보여주기"를 선택했을 때만 true로 바뀌고, 그때만 owner 쪽 그래프에
 * 이름이 보인다 — opt-in이 없으면 절대 켜지지 않는다.
 */
export const referralVisits = pgTable("referral_visits", {
  id: uuid("id").defaultRandom().primaryKey(),
  referralLinkId: uuid("referral_link_id")
    .notNull()
    .references(() => referralLinks.id, { onDelete: "cascade" }),
  visitorParticipantId: uuid("visitor_participant_id")
    .notNull()
    .references(() => participants.id, { onDelete: "cascade" }),
  nickname: text("nickname"),
  status: text("status", { enum: ["connected", "unreachable"] }).notNull(),
  distance: integer("distance"),
  revealedToOwner: boolean("revealed_to_owner").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  visitorUnique: uniqueIndex("referral_visits_link_visitor_key").on(
    table.referralLinkId,
    table.visitorParticipantId,
  ),
}));

/** 두 참여자가 모두 참여를 완료했을 때 계산되는 최단 거리 결과. */
export const pairResults = pgTable("pair_results", {
  id: uuid("id").defaultRandom().primaryKey(),
  pairInviteId: uuid("pair_invite_id")
    .notNull()
    .references(() => pairInvites.id, { onDelete: "cascade" }),
  distance: integer("distance"),
  computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  pairInviteUnique: uniqueIndex("pair_results_pair_invite_key").on(table.pairInviteId),
}));

/**
 * TASK-003(v2) — 재사용 가능한 "지인 링크". `pairInvites`(1회용, 링크당
 * 정확히 1명만 accept 가능)와 달리 한 사람이 실제 지인 여러 명에게 같은
 * 링크를 반복해서 보낼 수 있다. 재사용을 허용하면서 사라진 1회용 토큰의
 * `maxUses`와 `expiresAt`은 초기 제한 설계에서 만들어진 레거시 컬럼이다. 현재 링크
 * 유효성 판정에는 사용하지 않으며, 파괴적 마이그레이션 전까지 호환 목적으로 남긴다.
 *
 * 한 participant는 유효한(만료·폐기되지 않은) 링크를 동시에 하나만
 * 가진다 — 새 링크를 만들면(`POST /api/links`) 기존 링크를 `revokedAt =
 * now()`로 폐기하고 새로 만든다(참여자별 링크 재발급, 여러 개 동시 발급
 * 없음). 관계 해제 기능이 없는 것과 별개로, 링크 자체의 폐기/재발급은
 * 소유자가 언제든 할 수 있다.
 */
export const acquaintanceLinks = pgTable("acquaintance_links", {
  id: uuid("id").defaultRandom().primaryKey(),
  token: text("token").notNull(),
  ownerParticipantId: uuid("owner_participant_id")
    .notNull()
    .references(() => participants.id, { onDelete: "cascade" }),
  maxUses: integer("max_uses").notNull().default(50),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tokenUnique: uniqueIndex("acquaintance_links_token_key").on(table.token),
}));

/**
 * TASK-003(v2) — 지인 링크 수신자가 "실제로 아는 사이"라고 확인한 기록.
 * 2026-09-13 결정 이후 이 테이블의 모든 행이 그래프의 edge 소스다(§
 * apps/web/lib/participants.ts의 `getAllEdges` 참고) — `link.ownerParticipantId`와
 * `confirmerParticipantId`의 조합이 곧 edge다. `pairInvites` 기반 1회용
 * edge 소스는 이 테이블로 교체됐다(코드는 삭제하지 않고 `follows`와 같은
 * 취급으로 보존).
 *
 * 한 사람은 같은 링크를 두 번 확인할 수 없다(UNIQUE) — 두 번째 확인
 * 요청은 에러 없이 기존 행 그대로 성공 처리한다(멱등). soft-delete
 * 컬럼을 의도적으로 두지 않는다 — 확인된 관계를 되돌리는 기능은 제품
 * 결정으로 제공하지 않는다(친밀도가 아니라 "실제로 아는 사이였다"는
 * 사실 자체를 기록하는 것이 이 그래프의 목적이므로, 관계가 나빠졌다는
 * 이유로 edge를 지우면 그 목적을 왜곡한다).
 */
export const acquaintanceConfirmations = pgTable("acquaintance_confirmations", {
  id: uuid("id").defaultRandom().primaryKey(),
  linkId: uuid("link_id")
    .notNull()
    .references(() => acquaintanceLinks.id, { onDelete: "cascade" }),
  confirmerParticipantId: uuid("confirmer_participant_id")
    .notNull()
    .references(() => participants.id, { onDelete: "cascade" }),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  linkConfirmerUnique: uniqueIndex("acquaintance_confirmations_link_confirmer_key").on(
    table.linkId,
    table.confirmerParticipantId,
  ),
}));
