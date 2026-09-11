import { normalizeUsername } from "./normalize";
import { extractFollowing } from "./zip";

export { normalizeUsername, extractUsernames } from "./normalize";
export { extractFollowing, InstagramExportParseError } from "./zip";
export { suggestUsernameFromFilename } from "./filename";

/**
 * 브라우저에서 실행하는 최상위 진입점.
 * ZIP -> following 목록 추출 -> 정규화/중복 제거까지 한 번에 처리한다.
 *
 * `selfUsername`을 넘기면 결과에서 제외한다 — 실제 인스타그램에서는 자기
 * 자신을 팔로우할 수 없지만, export 데이터의 정합성을 신뢰하지 않고 이
 * 단계에서 명시적으로 방어한다.
 */
export async function parseFollowingFromZip(
  zipInput: ArrayBuffer | Uint8Array | Blob,
  selfUsername?: string,
): Promise<string[]> {
  const following = await extractFollowing(zipInput);
  const normalized = new Set(following.map(normalizeUsername));

  if (selfUsername) {
    normalized.delete(normalizeUsername(selfUsername));
  }

  return [...normalized].sort();
}
