import { computeMutuals } from "./mutuals";
import { extractFollowerData, InstagramExportParseError } from "./zip";

export { normalizeUsername, extractUsernames } from "./normalize";
export { computeMutuals } from "./mutuals";
export { extractFollowerData, InstagramExportParseError } from "./zip";

/**
 * 브라우저에서 실행하는 최상위 진입점.
 * ZIP -> followers/following 추출 -> 맞팔 교집합까지 한 번에 처리한다.
 * 원본 follower/following 전체 목록은 반환하지 않고 mutuals만 반환하여,
 * 호출자가 실수로 전체 목록을 서버에 올리는 일을 구조적으로 막는다.
 */
export async function parseMutualsFromZip(
  zipInput: ArrayBuffer | Uint8Array | Blob,
): Promise<string[]> {
  const { followers, following } = await extractFollowerData(zipInput);
  return computeMutuals(followers, following);
}

export { suggestUsernameFromFilename } from "./filename";
