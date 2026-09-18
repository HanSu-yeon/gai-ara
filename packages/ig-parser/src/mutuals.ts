import { normalizeUsername } from "./normalize.ts";

/**
 * followers ∩ following = 맞팔(mutual follow) 목록.
 * 정규화 후 중복 제거, 정렬된 배열을 돌려준다.
 */
export function computeMutuals(
  followers: string[],
  following: string[],
): string[] {
  const followerSet = new Set(followers.map(normalizeUsername));
  const mutuals = new Set<string>();

  for (const raw of following) {
    const normalized = normalizeUsername(raw);
    if (followerSet.has(normalized)) {
      mutuals.add(normalized);
    }
  }

  return [...mutuals].sort();
}
