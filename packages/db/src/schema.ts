import {
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
 * "고스트" 노드는 없다 — 이 테이블은 실제로 자기 데이터를 업로드한
 * 사람만 담는다(participant-only 그래프). 누군가의 following 목록에만
 * 등장하고 아직 업로드하지 않은 사람은 `follows.followee_identity_hash`에
 * 해시만 남고, 이 테이블에는 그 사람이 직접 업로드하기 전까지 행이
 * 생기지 않는다.
 */
export const participants = pgTable("participants", {
  id: uuid("id").defaultRandom().primaryKey(),
  identityHash: text("identity_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  identityHashUnique: uniqueIndex("participants_identity_hash_key").on(table.identityHash),
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
