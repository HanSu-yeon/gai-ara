import { z } from "zod";

/**
 * 클라이언트가 ZIP을 파싱해서 얻은 "내가 팔로우하는 사람" 목록을 서버로
 * 올릴 때 쓰는 payload. followers 원본은 아예 전송하지 않는다 — mutual
 * 여부는 클라이언트가 판단하지 않고, 서버가 두 참여자의 following을
 * 대조해서 판정한다([01_DB_SCHEMA.md §4](../../../docs/03_Technical_Specs/01_DB_SCHEMA.md) 참고).
 */
export const uploadFollowingSchema = z.object({
  selfUsername: z.string().min(1).max(60),
  followingUsernames: z.array(z.string().min(1).max(60)).max(20_000),
});
export type UploadFollowingInput = z.infer<typeof uploadFollowingSchema>;

export const createInviteSchema = z.object({
  /** inviter 자신만 보는 메모 — recipient에게는 절대 노출되지 않는다. */
  label: z.string().max(40).optional(),
  /** recipient에게 그대로 보여줄 공개용 이름("OO님이 궁금해해요"). */
  nickname: z.string().max(20).optional(),
});
export type CreateInviteInput = z.infer<typeof createInviteSchema>;

export const meResultSchema = z.object({
  distanceCounts: z.object({
    direct: z.number().int().nonnegative(),
    within2: z.number().int().nonnegative(),
    within3: z.number().int().nonnegative(),
  }),
  /** 세션이 사라져도 "내 결과"로 돌아올 수 있는 개인용 복구 토큰. */
  recoveryToken: z.string(),
});
export type MeResult = z.infer<typeof meResultSchema>;

export const pairResultSchema = z.object({
  status: z.enum(["pending", "connected", "unreachable"]),
  distance: z.number().int().nonnegative().nullable(),
});
export type PairResult = z.infer<typeof pairResultSchema>;

/**
 * `GET /api/invites/{token}` 응답. inviterNickname은 inviter가 직접 공개로
 * 적은 이름이라 recipient에게 보여줘도 된다 — inviter의 신원(해시, id 등)
 * 자체는 여기에도 절대 포함하지 않는다.
 */
export const inviteStatusSchema = z.object({
  status: z.enum(["pending", "accepted", "expired", "not-found"]),
  inviterNickname: z.string().nullable().optional(),
});
export type InviteStatusResponse = z.infer<typeof inviteStatusSchema>;

/**
 * "내 연결 목록" 한 줄. label은 inviter 자신이 남긴 메모라 inviter 쪽
 * 행에서만 채워진다(recipient 쪽 행은 항상 null) — 상대방 신원은 절대
 * 포함하지 않는다. inviterNickname은 공개용이라 양쪽 다 받는다.
 */
export const myPairSummarySchema = z.object({
  token: z.string(),
  role: z.enum(["inviter", "recipient"]),
  label: z.string().nullable(),
  inviterNickname: z.string().nullable(),
  status: z.enum(["pending", "accepted", "expired"]),
  distance: z.number().int().nonnegative().nullable(),
  createdAt: z.string(),
});
export type MyPairSummary = z.infer<typeof myPairSummarySchema>;

export const myPairsResponseSchema = z.object({
  pairs: z.array(myPairSummarySchema),
});
export type MyPairsResponse = z.infer<typeof myPairsResponseSchema>;

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
