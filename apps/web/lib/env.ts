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
