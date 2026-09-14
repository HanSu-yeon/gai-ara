import { z } from "zod";

/**
 * 화면 06(`/result`)이 쓰는, 나를 root로 한 최대 6홉 그래프(2026-09-14
 * 최종 결정 — Six Degrees를 실제로 체감하는 화면이라 direct만으로는
 * 부족하다). `parentId`는 레이아웃(각도 배치)용 BFS 트리 부모일 뿐이고,
 * 실제로 그릴 선은 `edges` 전체다 — 트리 간선 + 트리에 없는 실제 간선
 * (삼각형·재합류)까지 포함한다. `depth === 1`인 노드만 표시 이름이 채워지고
 * (직접 아는 사람), `depth >= 2`는 항상 `displayName: null`이다 — 2촌
 * 이상의 신원은 이 API 자체가 내려보내지 않는다(클라이언트에서 숨기는 게
 * 아니라 서버 단계에서부터 제한).
 *
 * 렌더링 성능을 위해 2촌 이상 노드 수에는 상한이 있다 — 상한을 넘는
 * 나머지는 노드를 만들어 붙이지 않고 `hiddenBeyondCount`라는 집계 숫자로만
 * 알려준다(가짜 노드/간선을 추가하지 않는다는 원칙).
 */
export const meNetworkNodeSchema = z.object({
  id: z.string(),
  parentId: z.string().nullable(),
  depth: z.number().int().min(1).max(6),
  displayName: z.string().nullable(),
});
export type MeNetworkNode = z.infer<typeof meNetworkNodeSchema>;

export const meNetworkSchema = z.object({
  nodes: z.array(meNetworkNodeSchema),
  /** (id, id) 쌍 — 두 노드 다 `nodes`에 있고 실제로 confirmed 관계다. */
  edges: z.array(z.tuple([z.string(), z.string()])),
  /** 6홉 이내에는 있지만 렌더링 상한 때문에 노드로 내려보내지 않은 인원수. */
  hiddenBeyondCount: z.number().int().nonnegative(),
});
export type MeNetwork = z.infer<typeof meNetworkSchema>;

export const meResultSchema = z.object({
  distanceCounts: z.object({
    direct: z.number().int().nonnegative(),
    within2: z.number().int().nonnegative(),
    within3: z.number().int().nonnegative(),
  }),
  /** 화면 06 미니 그래프가 실제로 쓰는, 나를 root로 한 최대 6홉 그래프. */
  network: meNetworkSchema,
  /** 세션이 사라져도 "내 결과"로 돌아올 수 있는 개인용 복구 토큰. */
  recoveryToken: z.string(),
});
export type MeResult = z.infer<typeof meResultSchema>;

/**
 * `/r/{token}` 결과 경로에 들어가는 노드 하나. `displayName`이 채워지는
 * 경우는 두 endpoint(조회자 본인·링크 owner)이거나, 조회자 본인과 direct
 * confirmed인 중간자뿐이다(2026-09-14 결정 — "내가 직접 아는 사람은
 * 나에게 보이고, 내가 직접 모르는 사람은 익명이다"). 그 외에는 `id`도
 * 실제 participant UUID가 아니라 불투명 해시다.
 */
export const referralPathNodeSchema = z.object({
  id: z.string(),
  displayName: z.string().nullable(),
});
export type ReferralPathNode = z.infer<typeof referralPathNodeSchema>;

/** owner가 자기 링크로 들어온 방문자 한 명과의 결과를 다시 볼 때. */
export const referralVisitSchema = z.object({
  nickname: z.string().nullable(),
  status: z.enum(["connected", "unreachable"]),
  distance: z.number().int().nonnegative().nullable(),
});
export type ReferralVisit = z.infer<typeof referralVisitSchema>;

/**
 * 재사용 가능한 "내 소개 링크". `pair_invites`와 달리 특정 상대를 지정하지
 * 않는다 — 참여자당 하나만 있고 여러 사람이 같은 링크로 들어올 수 있다.
 * 링크에는 owner를 식별할 수 있는 정보를 아무것도 담지 않는다(닉네임 없음)
 * — 링크는 보통 카톡/DM/커뮤니티 게시글 등 바깥 맥락에서 누구의 링크인지
 * 이미 알려진 채로 공유된다.
 */
export const referralLinkSchema = z.object({
  token: z.string(),
  visits: z.array(referralVisitSchema),
});
export type ReferralLink = z.infer<typeof referralLinkSchema>;

/**
 * `POST /api/r/{token}/result` 요청 — nickname은 방문자가 owner에게
 * 자신을 표시하고 싶을 때만 선택적으로 보낸다.
 */
export const referralResultRequestSchema = z.object({
  nickname: z.string().max(20).optional(),
});
export type ReferralResultRequest = z.infer<typeof referralResultRequestSchema>;

/**
 * `POST /api/r/{token}/result` 응답 — 현재 세션(방문자)과 링크 owner 사이의
 * 거리. "self"는 owner 본인이 자기 링크를 열었을 때(이 경우는 기록하지
 * 않는다). 그 외에는 owner가 나중에 다시 볼 수 있도록 남는다.
 */
export const referralResultSchema = z.object({
  status: z.enum(["connected", "unreachable", "self"]),
  distance: z.number().int().nonnegative().nullable(),
  /** connected일 때만 채워짐 — 조회자 자신부터 owner까지의 실제 경로.
   * 중간자 이름 노출 규칙은 `referralPathNodeSchema` 참고. */
  path: z.array(referralPathNodeSchema).nullable(),
  /** unreachable일 때만 의미 있음 — 방문자 자신이 confirmed 관계가 하나도
   * 없는 신규 참여자인지("내 그래프가 아직 시작 안 됨") 구분한다. */
  visitorHasNoConnections: z.boolean().optional(),
});
export type ReferralResult = z.infer<typeof referralResultSchema>;

/**
 * `GET /api/r/{token}` 응답 — TASK-003(v2)부터 소유자 표시 이름을 포함한다
 * (v2 명세 §3.3). 여전히 소유자의 신원(해시, participant id)은 포함하지
 * 않는다.
 */
export const referralLinkPublicInfoSchema = z.object({
  ownerDisplayName: z.string().nullable(),
});
export type ReferralLinkPublicInfo = z.infer<typeof referralLinkPublicInfoSchema>;

/** `PATCH /api/me/display-name` 요청 — 공백/빈 문자열을 거부한다. */
export const updateDisplayNameSchema = z.object({
  displayName: z.string().trim().min(1).max(30),
});
export type UpdateDisplayNameInput = z.infer<typeof updateDisplayNameSchema>;

/**
 * `POST /api/instagram-import` 요청 — 2026-09-14 Instagram import
 * 재도입. 클라이언트(`@gai-ara/ig-parser`)가 브라우저에서 ZIP을 열어
 * followers ∩ following까지 계산한 뒤, 그 결과(맞팔 목록)만 여기로
 * 보낸다 — 원본 followers/following 전체 목록이나 ZIP 자체는 절대
 * 서버로 오지 않는다. 로그인은 이미 카카오 세션으로 끝난 상태라야 하므로
 * (§ `AGENTS.md` §0 각주), 여기엔 로그인용 필드가 없다.
 */
export const instagramImportSchema = z.object({
  selfUsername: z.string().min(1).max(60),
  mutualUsernames: z.array(z.string().min(1).max(60)).max(20_000),
});
export type InstagramImportInput = z.infer<typeof instagramImportSchema>;

/** `POST /api/instagram-import` 응답 — 실제로 계산된 맞팔 수만 돌려준다. */
export const instagramImportResultSchema = z.object({
  mutualCount: z.number().int().nonnegative(),
});
export type InstagramImportResult = z.infer<typeof instagramImportResultSchema>;

/**
 * `POST /api/challenges` 요청 — 2026-09-14 "타겟 챌린지" 기능, 2026-09-15
 * "협업형 챌린지"로 결과 모델 변경(아래 `challengeProgressSchema` 참고).
 * displayName은 챌린지 화면에 보여줄 표시 이름일 뿐 검증된 인물명이 아니다
 * — "궁금한 사람"이면 누구든 대상이 될 수 있고 유명인으로 한정하지
 * 않는다. instagramUsername은 해싱 직후 버려진다(서버 로그·응답에 절대
 * 남기지 않는다) — `hashInstagramUsername()`으로 만든 해시만 저장한다.
 */
export const createChallengeSchema = z.object({
  displayName: z.string().trim().min(1).max(30),
  instagramUsername: z.string().trim().min(1).max(60),
});
export type CreateChallengeInput = z.infer<typeof createChallengeSchema>;

/**
 * `POST /api/challenges` 응답 — 2026-09-15 결정, 동일 target(정규화된
 * username의 해시, `target_challenges.target_instagram_username_hash`
 * UNIQUE)으로는 챌린지를 중복 생성하지 않는다.
 *
 * - `status: "created"` — 새 챌린지를 만들었다. 호출자는 이미
 *   `challenge_participants`의 첫 참여자로 등록돼 있다.
 * - `status: "duplicate"` — 같은 target을 가리키는 챌린지가 이미 있다.
 *   **호출자를 그 챌린지에 자동으로 합류시키지 않는다** — 클라이언트가
 *   "이미 있어요, 합류할까요?" 화면을 먼저 보여주고, 사용자가 명시적으로
 *   동의해야만 `POST /api/challenges/{token}/join`을 호출한다. 기존
 *   챌린지의 `displayName`을 그대로 돌려준다 — 이번에 제출한 displayName은
 *   버려진다(최초 생성 시점 값을 덮어쓰지 않는다).
 */
export const createChallengeResultSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("created"), token: z.string() }),
  z.object({ status: z.literal("duplicate"), token: z.string(), displayName: z.string() }),
]);
export type CreateChallengeResult = z.infer<typeof createChallengeResultSchema>;

/**
 * 2026-09-15 협업형 챌린지 결정 — 챌린지 결과는 더 이상 "뷰어 개인 기준
 * connected/not_connected"가 아니라, 이 챌린지에 명시적으로 참여한
 * participant들(start-set)에서 출발해 전역 trusted graph를 거쳐 target까지
 * 닿는 최단 경로를 "우리가" 발견했는지를 나타낸다(`computeChallengeProgress`).
 *
 * `distance`는 그래프 edge 수 그대로다(UX 카피 "N다리" 변환은
 * `apps/web/lib/distance-copy.ts`가 `/r`과 동일한 규칙으로 담당 — 여기서는
 * 변환하지 않는다). `searching`일 때는 항상 null이다.
 *
 * 경로의 중간 노드는 물론 시작점(start-set 중 실제로 경로를 만든 사람)의
 * identity도 이 스키마에 없다 — client는 distance 하나만으로 "우리 ─ ○ ─
 * ○ ─ ○ ─ {target}" 형태를 그린다(익명 원의 개수 = distance - 1). 이 원칙은
 * `/r`의 `referralResultSchema.path`(뷰어의 direct 상대는 실명 공개)보다
 * 보수적이다 — 챌린지 결과는 특정 뷰어 한 명이 아니라 불특정 다수가 보는
 * 공개 공유 surface이기 때문이다.
 */
export const challengeProgressSchema = z.object({
  status: z.enum(["searching", "found"]),
  distance: z.number().int().nonnegative().nullable(),
});
export type ChallengeProgress = z.infer<typeof challengeProgressSchema>;

/**
 * 2026-09-15 "마지막 연결자 공개" 결정 — target 바로 직전(1홉) participant
 * 중, minimum distance를 달성하는 shortest path에 실제로 쓰인 사람 전부를
 * 가리킨다("마지막 연결자"). 중간 노드(2홉 이상)의 identity는 여전히
 * 절대 공개하지 않는다 — 이 원칙은 바뀌지 않는다. 마지막 연결자도
 * "공개 동의(`participants.publicConnectorNameConsentAt`)가 있는 사람의
 * displayName만" 노출한다 — 동의하지 않은 사람은 이름도 id도 이 스키마에
 * 담기지 않는다.
 *
 * - `lastConnectorCount`: 실제 distinct 마지막 연결자 수. 동의 여부와
 *   무관하다 — 닉네임 공개 여부가 챌린지 결과 자체를 바꾸지 않는다.
 * - `consentedLastConnectorCount`: 그중 공개에 동의한 사람 수(표시 여부와
 *   무관, `visibleLastConnectorNames`보다 많을 수 있다).
 * - `visibleLastConnectorNames`: 동의한 사람의 displayName, 최대 3명까지만
 *   (390px 화면에서 읽기 좋은 상한, `apps/web/lib/graph-service.ts`의
 *   `MAX_VISIBLE_LAST_CONNECTORS`). 클라이언트는 이 세 숫자/배열만으로
 *   "민지 · 수연 · 지훈 외 공개 3명 · 익명 2명" 같은 문구를 조립한다
 *   (`apps/web/lib/last-connector-copy.ts`) — participantId나 비공개
 *   displayName은 이 스키마 어디에도 없다.
 */
export const challengePublicResultSchema = challengeProgressSchema.extend({
  lastConnectorCount: z.number().int().nonnegative(),
  consentedLastConnectorCount: z.number().int().nonnegative(),
  visibleLastConnectorNames: z.array(z.string()),
});
export type ChallengePublicResult = z.infer<typeof challengePublicResultSchema>;

/**
 * `GET /api/challenges/{token}` 응답 — 로그인 전에도 조회 가능하다(공유
 * 링크를 로그인 전에 먼저 열 수 있어야 하므로). 대상의 Instagram 해시나
 * 만든 사람의 신원은 절대 포함하지 않는다. 2026-09-15 결정으로
 * `challengePublicResultSchema`(status/distance + 마지막 연결자 요약)를
 * 병합했다 — `/t/{token}` 랜딩 화면이 대상 이름과 진행 상황, 마지막
 * 연결자 요약을 한 번의 조회로 모두 그릴 수 있어야 하기 때문이다.
 */
export const challengePublicInfoSchema = z.object({
  displayName: z.string(),
  /**
   * 2026-09-15 추가 결정 — 챌린지 전체의 진행 상황과 **별개로**, 지금
   * 이 화면을 보는 본인이 target까지 몇 다리인지. 로그인한 뷰어에게만
   * 채워지고(비로그인이면 항상 null), 길이 없으면 null이다.
   *
   * 챌린지 status/distance를 대체하지 않고 함께 내려간다 — 챌린지는 아직
   * `searching`인데 뷰어에게는 길이 있을 수 있고(그 뷰어가 참여하면 그
   * 순간 챌린지가 풀린다), 반대일 수도 있다. 값은 거리 숫자 하나뿐이고
   * 중간 경로의 identity는 담기지 않는다.
   */
  viewerDistance: z.number().int().nonnegative().nullable(),
  /**
   * 이 뷰어가 이미 이 챌린지에 참여했는지(`challenge_participants`에 행이
   * 있는지). 비로그인이면 항상 false다. 이미 참여한 사람에게 "나도 연결
   * 보태기"를 다시 내밀지 않기 위한 값이다 — 그 사람에게 남은 다음 행동은
   * 연결을 또 보태는 게 아니라 챌린지를 퍼뜨리는 것이다.
   *
   * 참여자 수(`challenge_participants` 행 수)나 참여자 목록은 이 응답에
   * 담지 않는다 — "나 자신이 참여했는가"라는 불리언 하나뿐이다.
   */
  viewerJoined: z.boolean(),
}).merge(challengePublicResultSchema);
export type ChallengePublicInfo = z.infer<typeof challengePublicInfoSchema>;

/**
 * `POST /api/challenges/{token}/join` 응답 — 참여 직후 갱신된 진행 상황을
 * 바로 돌려준다(클라이언트가 별도로 `GET /api/challenges/{token}`을 다시
 * 부를 필요 없이 화면을 바로 갱신할 수 있게). 스키마는
 * `challengeProgressSchema`와 동일하다.
 */
export const joinChallengeResponseSchema = challengeProgressSchema;
export type JoinChallengeResponse = ChallengeProgress;

/**
 * `POST /api/links` 응답 — 재사용 가능한 지인 링크. 소유자 신원은 포함하지
 * 않는다(v2 명세 §3.2).
 */
export const acquaintanceLinkSchema = z.object({
  token: z.string(),
});
export type AcquaintanceLink = z.infer<typeof acquaintanceLinkSchema>;

/**
 * `GET /api/links/{token}` 응답(화면 04) — 소유자의 participant id·해시는
 * 포함하지 않는다. `ownerDisplayName`은 링크가 존재할 때만(not-found가
 * 아닐 때만) 채워진다.
 */
export const acquaintanceLinkStatusSchema = z.object({
  status: z.enum(["valid", "revoked", "not-found"]),
  ownerDisplayName: z.string().nullable(),
});
export type AcquaintanceLinkStatusResponse = z.infer<typeof acquaintanceLinkStatusSchema>;

/** `GET /api/me/connections` 한 줄 — 삭제 기능이 없으므로 제거용 id가 없다. */
export const connectionSummarySchema = z.object({
  displayName: z.string(),
  confirmedAt: z.string(),
});
export type ConnectionSummary = z.infer<typeof connectionSummarySchema>;

export const connectionsResponseSchema = z.object({
  connections: z.array(connectionSummarySchema),
});
export type ConnectionsResponse = z.infer<typeof connectionsResponseSchema>;

/** `GET /api/session` 응답 — 참여자 신원은 절대 포함하지 않는다. */
export const sessionInfoSchema = z.object({
  active: z.boolean(),
  hasDisplayName: z.boolean(),
});
export type SessionInfo = z.infer<typeof sessionInfoSchema>;
