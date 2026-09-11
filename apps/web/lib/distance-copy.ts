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
