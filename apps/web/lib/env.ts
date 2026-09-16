const PLACEHOLDER_PEPPER = "change-me-to-a-random-64-char-hex-string";

/**
 * DB/식별자 해싱에 필요한 환경 변수가 실제로 설정됐는지 확인한다.
 * 설정 안 된 채로 DB에 접근하면 라우트마다 제각각의 500이 나가버리므로,
 * API 라우트 진입점에서 먼저 이걸로 막고 일관된 503을 돌려준다.
 */
export function isBackendConfigured(): boolean {
  return Boolean(
    process.env.DATABASE_URL &&
      process.env.IDENTITY_PEPPER &&
      process.env.IDENTITY_PEPPER !== PLACEHOLDER_PEPPER,
  );
}

/**
 * 카카오 로그인(Auth.js)에 필요한 환경 변수가 실제로 설정됐는지 확인한다.
 * 카카오 디벨로퍼스 앱 등록은 사용자가 직접 해야 하는 외부 작업이라(TASK-003
 * Implementation Preconditions), 값이 없어도 코드/타입체크는 통과해야
 * 하지만 실제 로그인 요청은 여기서 먼저 막고 명확한 503을 돌려준다.
 */
export function isKakaoAuthConfigured(): boolean {
  return Boolean(
    process.env.KAKAO_CLIENT_ID && process.env.KAKAO_CLIENT_SECRET && process.env.NEXTAUTH_SECRET,
  );
}

/**
 * Google 로그인(Auth.js)에 필요한 환경 변수가 실제로 설정됐는지 확인한다.
 * `isKakaoAuthConfigured()`와 같은 패턴 — Google Cloud Console에서 OAuth
 * 클라이언트를 만드는 것은 사용자가 직접 해야 하는 외부 작업이라, 값이
 * 없어도 코드/타입체크는 통과해야 하지만 실제 로그인 요청은 라우트
 * 핸들러에서 먼저 막고 명확한 503을 돌려준다(2026-09-16 결정 — 결정 로그
 * "로그인 제공자에 Google 추가" 참고).
 */
export function isGoogleAuthConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.NEXTAUTH_SECRET,
  );
}
