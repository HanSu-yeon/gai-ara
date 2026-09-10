import { z } from "zod";

/**
 * 클라이언트가 ZIP을 파싱해서 계산한 "나의 맞팔 목록"을 서버로 올릴 때 쓰는 payload.
 * 원본 팔로워/팔로잉 전체 목록이 아니라 교집합(mutuals)만 전송한다.
 */
export const uploadMutualsSchema = z.object({
  selfUsername: z.string().min(1).max(60),
  mutualUsernames: z.array(z.string().min(1).max(60)).max(20_000),
});
export type UploadMutualsInput = z.infer<typeof uploadMutualsSchema>;

export const createInviteSchema = z.object({
  label: z.string().max(40).optional(),
});
export type CreateInviteInput = z.infer<typeof createInviteSchema>;

export const meResultSchema = z.object({
  distanceCounts: z.object({
    direct: z.number().int().nonnegative(),
    within2: z.number().int().nonnegative(),
    within3: z.number().int().nonnegative(),
  }),
  totalParticipants: z.number().int().nonnegative(),
  percentileWithin3: z.number().min(0).max(100),
});
export type MeResult = z.infer<typeof meResultSchema>;

export const pairResultSchema = z.object({
  status: z.enum(["pending", "connected", "unreachable"]),
  distance: z.number().int().nonnegative().nullable(),
});
export type PairResult = z.infer<typeof pairResultSchema>;
