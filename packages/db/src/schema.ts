import {
  boolean,
  index,
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
 *
 * instagramUsernameHash: 2026-09-14 Instagram import 재도입 결정 — 카카오
 * 로그인이 신원 판별의 유일한 기준이므로(identityHash처럼 매칭에 쓰이지
 * 않는다), 본인이 "이게 내 인스타 계정이에요"라고 직접 확인한 username의
 * 해시만 여기 별도로 저장한다. `follows.followee_identity_hash`가 이
 * 컬럼과 대조돼야 맞팔 상대가 실제 참여자인지 알 수 있다(§ `follows` 참고).
 * NULL 허용(대부분은 인스타 연동을 안 함) — Postgres는 유니크 인덱스에서
 * NULL끼리는 서로 충돌시키지 않으므로 여러 명이 NULL이어도 문제없다.
 *
 * publicConnectorNameConsentAt: 2026-09-15 "마지막 연결자 공개" 결정 —
 * 이 참여자가 어느 챌린지의 "target 바로 직전 연결자"로 계산됐을 때,
 * 그 displayName을 공개 챌린지 결과에 실어도 되는지의 동의 시각이다.
 * NULL이면 절대 공개하지 않는다(기본값이자 안전한 쪽). `setDisplayName`
 * (apps/web/lib/participants.ts)이 **표시 이름을 최초로 설정하는 순간에만**
 * 함께 채운다 — 화면 02(로그인 뒤 이름 입력)가 "길의 마지막 연결자가
 * 되면 이 이름이 챌린지에 표시될 수 있어요"라는 고지를 보여준 다음에
 * 제출을 받는 흐름이기 때문에, 그 제출 자체가 동의다. 이미 displayName이
 * 있는 상태에서 이 값을 다시 호출해도(현재 UI에는 그런 경로가 없지만)
 * 이 컬럼은 건드리지 않는다 — 그 사용자가 이 고지를 실제로 봤다는 보장이
 * 없기 때문이다. 이 기능 도입 전에 이미 표시 이름을 설정한 기존
 * 참여자는 이 고지를 본 적이 없으므로 이 값이 계속 NULL로 남고, 소급
 * 공개되지 않는다.
 */
export const participants = pgTable("participants", {
  id: uuid("id").defaultRandom().primaryKey(),
  identityHash: text("identity_hash").notNull(),
  recoveryToken: text("recovery_token").notNull(),
  displayName: text("display_name"),
  instagramUsernameHash: text("instagram_username_hash"),
  publicConnectorNameConsentAt: timestamp("public_connector_name_consent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  identityHashUnique: uniqueIndex("participants_identity_hash_key").on(table.identityHash),
  recoveryTokenUnique: uniqueIndex("participants_recovery_token_key").on(table.recoveryToken),
  instagramUsernameHashUnique: uniqueIndex("participants_instagram_username_hash_key").on(
    table.instagramUsernameHash,
  ),
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
 * 2026-09-14 Instagram import 재도입 — 이름은 과거(participant-only 모델
 * 시절) "내가 팔로우하는 사람" 원본 그대로지만, 지금은 의미가 다르다:
 * 한 참여자가 자기 Instagram export에서 계산한 "맞팔(followers ∩
 * following)" 상대 하나당 한 행이다(`packages/ig-parser`의
 * `computeMutuals` 참고) — 팔로잉 전체가 아니라 이미 교집합까지 끝난
 * 결과만 저장한다. followeeIdentityHash는 FK가 아니라 그 상대 Instagram
 * username의 해시다(`participants.identityHash`가 아니라
 * `participants.instagramUsernameHash`와 대조한다) — 아직 그 사람이
 * 가입 전이거나 자기 인스타 계정을 연동하기 전이어도 해시를 미리 담아둘
 * 수 있어야, 나중에 연동했을 때 곧바로 대조가 가능하다. 재업로드 시
 * 이 참여자의 행을 전부 지우고 새 맞팔 목록으로 다시 채운다(source별
 * 독립적 동기화 — `acquaintance_confirmations`의 확정 관계는 건드리지
 * 않는다).
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
  // `follows_pair_key`는 (follower_participant_id, followee_identity_hash) 복합키라
  // 선행 컬럼이 follower_participant_id다 — "이 해시를 맞팔로 등록한 사람이
  // 누구든" 찾는 조회(타겟 챌린지 Path Check, `getParticipantIdsFollowingInstagramHash`)는
  // followeeIdentityHash만 갖고 시작하므로 이 복합 인덱스를 효율적으로 타지
  // 못한다. 단일 컬럼 인덱스를 별도로 둔다(2026-09-14, `01_DB_SCHEMA.md` §4.8).
  followeeHashIdx: index("follows_followee_identity_hash_idx").on(table.followeeIdentityHash),
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

/**
 * 2026-09-14 "타겟 챌린지" 기능 — 일반 참여자가 궁금한 대상(꼭 참여자가
 * 아니어도 됨, 예: 연예인) 하나를 지정해 "이 사람까지 몇 다리인지 같이
 * 확인해보자"는 공유 가능한 챌린지를 만든다. 운영자가 미리 대상을
 * 등록하는 방식이 아니라, 참여자가 직접 만든다 — 유명인 사전 DB가
 * 아니다.
 *
 * displayName은 만든 사람이 챌린지 화면에 보여주려고 직접 입력한 이름일
 * 뿐, 공식적으로 검증된 인물명이 아니다(예: 오타·별명이어도 그대로 씀).
 * targetInstagramUsernameHash는 `hashInstagramUsername()`으로 만든 해시만
 * 저장한다 — 원본 username은 절대 저장하지 않는다(`AGENTS.md` §1 원칙 2).
 * 대상이 실제 참여자라면 `participants.instagramUsernameHash`와 대조해서
 * 찾고, 아직 참여자가 아니면(`follows.followeeIdentityHash`로 이 해시를
 * 맞팔로 등록해둔 실제 참여자들을 거쳐) 그 참여자까지의 거리 + 1로
 * 계산한다(`apps/web/lib/graph-service.ts`의 `computeChallengeProgress`
 * 참고) — 이때도 external 대상 자체는 그래프에 노드로 저장하지 않는다.
 *
 * targetInstagramUsernameHash는 UNIQUE다(2026-09-15 결정) — 같은 target에
 * 대한 챌린지가 여러 개로 쪼개지지 않고 하나로 합쳐지도록, "동일 target =
 * 동일 challenge"를 DB 제약으로 강제한다. 중복 판정은 displayName이 아니라
 * 이 해시(= normalize된 Instagram username)로만 한다 — "부승관"과 "승관"이
 * 같은 계정을 가리키면 같은 challenge로 합쳐지고, displayName은 최초
 * 생성 시점 값을 그대로 유지한다(`apps/web/lib/challenges.ts`의
 * `createChallenge` 참고, 새 입력값으로 덮어쓰지 않는다).
 */
export const targetChallenges = pgTable("target_challenges", {
  id: uuid("id").defaultRandom().primaryKey(),
  token: text("token").notNull(),
  displayName: text("display_name").notNull(),
  targetInstagramUsernameHash: text("target_instagram_username_hash").notNull(),
  creatorParticipantId: uuid("creator_participant_id")
    .notNull()
    .references(() => participants.id, { onDelete: "cascade" }),
  /**
   * 2026-09-15 "홈 공개 챌린지 목록" 결정 — 홈(화면 01)에 노출해도 되는
   * 챌린지인지 여부. **기본값은 false이고, 사용자용 공개/비공개 설정 UI는
   * 만들지 않는다** — 운영자가 유명인/크리에이터처럼 공개해도 되는 대상만
   * 직접 SQL로 켠다. 사용자가 만든 챌린지가 자동으로 공개 디렉터리에
   * 올라가는 경로를 코드/스키마 어디에도 두지 않기 위한 설계다
   * (`AGENTS.md` §1 원칙 3 — 사람을 찾아내는 디렉터리는 금지, 일반인
   * 대상 챌린지는 토큰을 아는 사람만 열 수 있어야 한다).
   *
   * 공개 대상이 소수(홈에 3~5개)라 별도 인덱스를 두지 않는다 — 전체
   * 챌린지 수가 인덱스가 필요한 규모가 되면 그때 partial index를 추가한다.
   */
  isPublic: boolean("is_public").notNull().default(false),
  /**
   * 2026-09-15 — "공유하기" 버튼이 실제로 공유/복사까지 완료된 횟수
   * (운영자 전용 지표). 공개 API 응답(`challengePublicResultSchema` 등)
   * 어디에도 이 값을 실어 보내지 않는다 — 조회수처럼 화면에 보여주는
   * 숫자가 아니라, 운영자가 DB를 직접 봐야만 알 수 있는 내부 지표다.
   * GA4의 `challenge_share` 이벤트가 어느 챌린지인지 식별자 없이 보내는
   *것과 같은 이유(비공개 챌린지의 displayName을 제3자 서비스에 넘기지
   * 않기 위해)로, 챌린지별 집계는 우리 DB에만 쌓는다.
   */
  shareCount: integer("share_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tokenUnique: uniqueIndex("target_challenges_token_key").on(table.token),
  targetHashUnique: uniqueIndex("target_challenges_target_hash_key").on(table.targetInstagramUsernameHash),
}));

/**
 * 2026-09-15 "협업형 챌린지" 모델 — 챌린지의 그래프 탐색 시작점(start-set)
 * 멤버십만 기록하는 순수 join table이다. `/t/{token}`을 열어본 것만으로는
 * (page view) 여기 행이 생기지 않는다 — "나도 연결 보태기" 버튼을 눌러
 * 명시적으로 참여했을 때만(`joinChallenge`) upsert된다.
 *
 * 이 테이블에 들어간다고 새 edge가 생기는 게 아니다 — "이 참여자가 이미
 * 갖고 있는 confirmed acquaintance/Instagram mutual 관계 전체를 이
 * 챌린지의 시작점으로 써도 된다"는 의미의 멤버십 표시일 뿐이다. 실제
 * traversal은 여전히 `getAllEdges()`가 반환하는 전역 trusted graph를
 * 그대로 쓴다 — 중간 노드가 같은 챌린지에 참여했을 필요는 없다.
 *
 * 챌린지 생성자는 `createChallenge` 트랜잭션 안에서 자동으로 첫
 * participant로 upsert된다(2026-09-15 결정) — 만든 사람이 자기 네트워크를
 * 시작점으로 쓰지 않는 게 오히려 어색하기 때문이다.
 *
 * soft-delete/탈퇴 컬럼을 두지 않는다 — `acquaintance_confirmations`와
 * 같은 이유로, MVP에서는 탈퇴 기능 자체를 제공하지 않는다.
 */
export const challengeParticipants = pgTable("challenge_participants", {
  id: uuid("id").defaultRandom().primaryKey(),
  challengeId: uuid("challenge_id")
    .notNull()
    .references(() => targetChallenges.id, { onDelete: "cascade" }),
  participantId: uuid("participant_id")
    .notNull()
    .references(() => participants.id, { onDelete: "cascade" }),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  // 선행 컬럼이 challengeId라 "이 챌린지의 start-set 전체 조회"(챌린지
  // progress 계산이 매 요청마다 필요로 하는 바로 그 조회)가 이 유니크
  // 인덱스를 그대로 탄다 — `follows`처럼 별도 단일 컬럼 인덱스를 추가할
  // 필요가 없다.
  challengeParticipantUnique: uniqueIndex("challenge_participants_challenge_participant_key").on(
    table.challengeId,
    table.participantId,
  ),
}));
