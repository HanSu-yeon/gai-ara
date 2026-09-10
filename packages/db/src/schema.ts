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
 * hasUploadedOwnData: 이 사람이 "직접" 서비스에 들어와 자기 ZIP을 올렸는지.
 * false인 행은 다른 누군가의 맞팔 목록에 등장해서 생성된 "고스트" 노드로,
 * 그래프 성장을 위해 필요하지만 본인이 참여를 완료한 것은 아니다.
 */
export const participants = pgTable("participants", {
  id: uuid("id").defaultRandom().primaryKey(),
  identityHash: text("identity_hash").notNull(),
  hasUploadedOwnData: boolean("has_uploaded_own_data").notNull().default(false),
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
 * 맞팔 관계(edge). 무방향 관계이므로 항상
 * participantAId < participantBId (문자열 비교) 순서로 저장해서
 * (A,B)/(B,A) 중복 저장을 막는다 — 애플리케이션 레이어에서 강제한다.
 */
export const relationships = pgTable("relationships", {
  id: uuid("id").defaultRandom().primaryKey(),
  participantAId: uuid("participant_a_id")
    .notNull()
    .references(() => participants.id, { onDelete: "cascade" }),
  participantBId: uuid("participant_b_id")
    .notNull()
    .references(() => participants.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  pairUnique: uniqueIndex("relationships_pair_key").on(
    table.participantAId,
    table.participantBId,
  ),
}));

export const pairInviteStatus = ["pending", "accepted", "expired"] as const;
export type PairInviteStatus = (typeof pairInviteStatus)[number];

/** "우리 몇다리?" 공유 링크. token은 추측 불가능한 무작위 값이어야 한다. */
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
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, (table) => ({
  tokenUnique: uniqueIndex("pair_invites_token_key").on(table.token),
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
