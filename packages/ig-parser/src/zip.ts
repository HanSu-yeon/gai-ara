import JSZip from "jszip";
import { extractUsernames } from "./normalize";

const FOLLOWERS_FILE_PATTERN = /followers(_\d+)?\.json$/i;
const FOLLOWING_FILE_PATTERN = /following\.json$/i;

export class InstagramExportParseError extends Error {}

/**
 * Meta에서 받은 "내 정보 다운로드" ZIP을 그대로 받아서 followers/following
 * username 목록을 뽑아낸다. 사용자가 ZIP을 직접 풀거나 JSON 경로를 찾을
 * 필요가 없도록, ZIP 내부 어디에 파일이 있든(폴더 구조가 조금 달라도)
 * 파일명 패턴으로만 찾는다.
 */
export async function extractFollowerData(
  zipInput: ArrayBuffer | Uint8Array | Blob,
): Promise<{ followers: string[]; following: string[] }> {
  const zip = await JSZip.loadAsync(zipInput);

  const followers: string[] = [];
  const following: string[] = [];
  let matchedAnyFile = false;

  const entries = Object.values(zip.files).filter((f) => !f.dir);

  for (const entry of entries) {
    const isFollowers = FOLLOWERS_FILE_PATTERN.test(entry.name);
    const isFollowing = FOLLOWING_FILE_PATTERN.test(entry.name);
    if (!isFollowers && !isFollowing) continue;

    matchedAnyFile = true;
    const raw = await entry.async("string");

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // 손상되었거나 JSON이 아닌 동일 이름 파일은 건너뛴다.
      continue;
    }

    const usernames = extractUsernames(parsed);
    if (isFollowers) followers.push(...usernames);
    else following.push(...usernames);
  }

  if (!matchedAnyFile) {
    throw new InstagramExportParseError(
      "ZIP에서 followers/following 데이터를 찾지 못했어요. Instagram '내 정보 다운로드'에서 받은 파일이 맞는지 확인해주세요.",
    );
  }

  return { followers, following };
}
