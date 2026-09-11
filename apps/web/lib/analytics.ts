declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * GA4 커스텀 이벤트. 페이지뷰/체류시간/이탈률은 layout.tsx의 기본 gtag
 * 설정만으로 이미 잡힌다 — 여기서는 "무엇을 봤는지"가 아니라 "무엇을
 * 했는지"(업로드 성공/실패, 링크 생성/복사, 결과 종류)만 추가로 보낸다.
 * 사용자 식별 정보(아이디, 닉네임 등)는 절대 이벤트 파라미터에 넣지 않는다.
 */
export function trackEvent(name: string, params?: Record<string, string | number | boolean>): void {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag("event", name, params);
}
