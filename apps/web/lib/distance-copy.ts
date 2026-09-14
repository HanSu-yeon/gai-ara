const KOREAN_NUMERALS = ["", "한", "두", "세", "네", "다섯", "여섯", "일곱", "여덟", "아홉"];

/**
 * BFS distance(그래프 edge 개수)를 "몇 다리 건너 아는 사이"라는 한국어 UX
 * 문구로 바꾼다.
 *
 * `distance`는 edge 수다 (A-B = 1, A-C-B = 2, A-C-D-B = 3 ...). 반면 화면
 * 문구의 "N다리"는 자연스러운 한국어 표현을 위해 "중간에 낀 사람 수"
 * (intermediaries = distance - 1)를 가리키도록 정했다 — 즉 이 둘은
 * 의도적으로 다른 숫자다:
 *   - distance 1 (직접 연결, 중간자 0명) → "바로 아는 사이"
 *   - distance 2 (중간자 1명)            → "한 다리 건너 아는 사이"
 *   - distance 3 (중간자 2명)            → "두 다리 건너 아는 사이"
 *
 * 이 변환은 오직 화면 문구를 위한 것이고, API 응답이나 분석 이벤트로 나가는
 * `distance` 값 자체는 절대 여기서 바꾸지 않는다 — BFS distance(정확한 edge
 * 수)와 UX 카피(중간자 수 기준 "N다리")를 이 경계에서만 명확히 분리한다.
 */
export function formatConnectionPhrase(distance: number): string {
  if (distance <= 1) return "바로 아는 사이";

  const intermediaries = distance - 1;
  const numeral = KOREAN_NUMERALS[intermediaries] ?? `${intermediaries}`;
  return `${numeral} 다리 건너 아는 사이`;
}

/**
 * 화면 08~11(공개 링크) 전용 문구. `formatConnectionPhrase`와 같은
 * `distance - 1` 규칙을 쓰지만, "다리/단계" 대신 "사람을 거치면"으로
 * 옮기는 카피 원칙(`02_INVITE_GRAPH_CONCEPT.md` 카피 원칙)을 따른다 —
 * 점 개수(intermediaries)와 이 문구의 숫자가 항상 같아야 한다.
 */
export function formatIntermediaryPhrase(distance: number): string {
  const intermediaries = Math.max(distance - 1, 0);
  if (intermediaries === 0) return "바로 연결되어 있어요.";

  const numeral = KOREAN_NUMERALS[intermediaries] ?? `${intermediaries}`;
  return `${numeral} 사람을 거치면 서로 닿아요.`;
}

/**
 * 화면 09(연결 발견) 헤드라인 — 최대 거리를 가정하지 않는다. `distance`는
 * 실제 shortest-path 결과 그대로 받아 그때그때 문구를 만든다(2026-09-14
 * 결정: "최대 몇 다리까지"가 아니라 "실제로 몇 다리 건너"를 보여준다).
 */
export function formatConnectionHeadline(distance: number): { top: string; bottom: string } {
  if (distance <= 1) return { top: "이미 바로", bottom: "아는 사이네요" };

  const intermediaries = distance - 1;
  const numeral = KOREAN_NUMERALS[intermediaries] ?? `${intermediaries}`;
  return { top: `${numeral} 다리 건너`, bottom: "아는 사이" };
}

/** 화면 09 헤드라인 바로 아래 보조 문구. */
export function formatConnectionSubtitle(distance: number): string {
  if (distance <= 1) return "다른 사람을 거치지 않고 바로 아는 사이예요.";

  const intermediaries = distance - 1;
  return `둘 사이에 ${intermediaries}명의 지인이 이어져 있어요.`;
}

/**
 * 2026-09-15 "홈 공개 챌린지 목록" 결정 — 홈 목록의 챌린지 한 줄짜리 상태
 * 문구. 목록에서는 복잡한 상태를 만들지 않는다: "찾는 중"과 "N다리 발견"
 * 두 가지뿐이다(원래 지시 §11).
 *
 * `distance`는 다른 화면과 똑같이 그래프 edge 수 그대로 받고, "N다리"
 * 변환도 이 파일의 기존 규칙(intermediaries = distance - 1)을 그대로
 * 따른다 — 목록이라고 다른 숫자를 쓰면 같은 챌린지를 눌러 들어간
 * `/t/{token}`의 헤드라인과 숫자가 어긋난다. 다만 목록은 한 줄에 들어가야
 * 하므로 한글 수사("네 다리")가 아니라 아라비아 숫자("4다리")를 쓴다.
 *
 * `participantCount`는 `challenge_participants` 행 수이고, 그 사람들이 곧
 * 이 챌린지의 start-set이다 — "312명 참여"는 실제로 탐색에 쓰이는 숫자다.
 * 경로를 이미 찾은 챌린지에서는 참여자 수 대신 발견한 거리를 보여준다.
 */
export function formatChallengeListStatus(
  status: "searching" | "found",
  distance: number | null,
  participantCount: number,
): string {
  if (status === "found" && distance !== null) {
    if (distance <= 1) return "바로 아는 사이 발견";
    return `${distance - 1}다리 발견`;
  }
  return `${participantCount}명 참여 · 찾는 중`;
}
