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
