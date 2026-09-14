const RETURN_TO_TOKEN_PATTERN = /^\/(?:invite|r|t)\/[A-Za-z0-9_-]+$/;
const RETURN_TO_EXACT_PATHS = new Set(["/connect", "/result", "/upload", "/create", "/me"]);

/**
 * 로그인 뒤 돌아갈 수 있는 내부 경로만 명시적으로 허용한다(allowlist) —
 * 토큰형 경로(`/invite/{token}`, `/r/{token}`, `/t/{token}` — 2026-09-15
 * 협업형 챌린지 결정으로 추가)와 로그인 사용자 전용 화면(`/connect`,
 * `/result`, `/upload`, `/create`, `/me`) 두 종류뿐이다. 여기 빠진 경로는
 * 조용히 fallback으로 떨어지므로, 로그인을 요구하는 화면을 새로 만들면
 * 이 목록에 반드시 추가한다. 이 목록에 없는 값은(외부
 * URL, `//`로 시작하는 프로토콜 상대 경로, 알 수 없는 내부 경로 포함) 전부
 * null로 떨어뜨려 open redirect를 원천 차단한다 — 호출부는 null이면 항상
 * 안전한 fallback 경로를 쓴다.
 */
export function normalizeReturnTo(value: string | null | undefined): string | null {
  if (!value) return null;
  if (RETURN_TO_EXACT_PATHS.has(value)) return value;
  if (RETURN_TO_TOKEN_PATTERN.test(value)) return value;
  return null;
}

export function loginPathFor(returnTo: string): string {
  return `/login?returnTo=${encodeURIComponent(returnTo)}`;
}
