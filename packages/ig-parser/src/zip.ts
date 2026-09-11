import JSZip from "jszip";
import { extractUsernames } from "./normalize";

const FOLLOWING_FILE_PATTERN = /following\.json$/i;

export class InstagramExportParseError extends Error {}

/**
 * Meta에서 받은 "내 정보 다운로드" ZIP에서 following(내가 팔로우하는 사람)
 * username 목록만 뽑아낸다. followers는 이 서비스가 아예 쓰지 않는다 —
 * 맞팔 여부는 두 참여자의 following을 서버가 대조해서 판정하므로, "누가
 * 나를 팔로우하는가"는 애초에 필요 없다
 * ([01_DB_SCHEMA.md §4](../../../docs/03_Technical_Specs/01_DB_SCHEMA.md) 참고).
 *
 * 사용자가 ZIP을 직접 풀거나 JSON 경로를 찾을 필요가 없도록, ZIP 내부
 * 어디에 파일이 있든(폴더 구조가 조금 달라도) 파일명 패턴으로만 찾는다.
 */
export async function extractFollowing(
  zipInput: ArrayBuffer | Uint8Array | Blob,
): Promise<string[]> {
  const zip = await JSZip.loadAsync(zipInput);

  const following: string[] = [];
  let matchedFiles = 0;
  let parsedFiles = 0;

  const entries = Object.values(zip.files).filter((f) => !f.dir);

  for (const entry of entries) {
    if (!FOLLOWING_FILE_PATTERN.test(entry.name)) continue;
    matchedFiles += 1;

    const raw = await entry.async("string");

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // 손상되었거나 JSON이 아닌 동일 이름 파일은 건너뛴다.
      continue;
    }

    parsedFiles += 1;
    following.push(...extractUsernames(parsed));
  }

  // following은 이 서비스가 요청하는 유일한 카테고리라, 파일이 아예 없으면
  // "팔로잉이 0명"보다는 "잘못된 export/파일"일 가능성이 훨씬 크다(followers/
  // following 두 카테고리를 같이 받던 이전 설계와 달리, 대조할 다른 파일이
  // 없어 모호함을 해소할 방법이 없다).
  if (matchedFiles === 0) {
    throw new InstagramExportParseError(
      "ZIP에서 following 데이터를 찾지 못했어요. Instagram '내 정보 다운로드'에서 받은 파일이 맞는지 확인해주세요.",
    );
  }

  // 파일명은 매칭됐는데 하나도 정상적으로 읽지 못했다면 "0명"이 아니라
  // 데이터가 손상된 것이다.
  if (parsedFiles === 0) {
    throw new InstagramExportParseError(
      "ZIP 안의 팔로잉 파일을 읽는 데 문제가 있어요. 손상되지 않은 파일인지 확인하고 다시 시도해주세요.",
    );
  }

  return following;
}
