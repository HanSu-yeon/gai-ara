import { z } from "zod";

/**
 * 화면 06 미니 그래프 노드 하나. root(나) 자신은 포함하지 않는다.
 * `parentId`가 null이면 root에 직접 연결된 노드(depth 1)다. `displayName`은
 * 이 노드가 트리의 leaf(더 뻗어나가지 않는 끝)이고 표시 이름을 설정한
 * 참여자일 때만 채워진다 — 중간에 낀 연결자는 leaf가 아니므로 항상
 * `displayName: null`로 내려간다(v2 명세, 2026-09-14 결정).
 */
export const egoNetworkNodeSchema = z.object({
  id: z.string(),
  parentId: z.string().nullable(),
  depth: z.number().int().min(1).max(3),
  displayName: z.string().nullable(),
});
export type EgoNetworkNode = z.infer<typeof egoNetworkNodeSchema>;

export const meResultSchema = z.object({
  distanceCounts: z.object({
    direct: z.number().int().nonnegative(),
    within2: z.number().int().nonnegative(),
    within3: z.number().int().nonnegative(),
  }),
  /** 화면 06 미니 그래프에 그릴 익명 대표 경로의 BFS 거리(최대 6개). */
  representativeDistances: z.array(z.number().int().min(1).max(3)).max(6),
  /** 화면 06 미니 그래프가 실제로 쓰는, 나를 root로 한 2~3홉 이내 트리. */
  network: z.array(egoNetworkNodeSchema),
  /** 세션이 사라져도 "내 결과"로 돌아올 수 있는 개인용 복구 토큰. */
  recoveryToken: z.string(),
});
export type MeResult = z.infer<typeof meResultSchema>;

/**
 * 두 참여자 사이의 거리 계산 결과 — `computePairResult`(graph-service)의
 * 반환 타입. `/api/r/{token}/result`(화면 08~10)가 이 함수를 그대로 쓴다.
 */
export const pairResultSchema = z.object({
  status: z.enum(["pending", "connected", "unreachable"]),
  distance: z.number().int().nonnegative().nullable(),
});
export type PairResult = z.infer<typeof pairResultSchema>;

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
