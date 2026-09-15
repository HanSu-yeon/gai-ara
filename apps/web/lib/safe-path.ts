/**
 * 외부 분석 서비스(GA4, Vercel Web Analytics)로 내보내도 되는 경로 구간.
 *
 * 이 서비스의 경로에는 토큰이 들어간다(`/t/{token}`, `/r/{token}`,
 * `/invite/{token}`, `/result/{recoveryToken}`). 토큰은 그 자체로 특정
 * 챌린지나 특정 사람의 링크라서 분석 도구에 남기지 않는다 — 어떤 화면을
 * 봤는지만 알면 충분하고, 누구의 링크였는지는 알 필요가 없다.
 *
 * 그래서 경로의 **첫 구간만** 쓰고 나머지는 버린다. 목록에 없는 구간은
 * 전부 `/`로 접는다(새 화면이 생겼을 때 토큰이 실수로 새어 나가는 것보다,
 * 집계가 `/`에 잠깐 뭉치는 쪽이 낫다).
 */
export const SAFE_PATH_SECTIONS = [
  "upload",
  "result",
  "r",
  "pair",
  "connections",
  "privacy",
  "preview",
  // 2026-09-15 협업형 챌린지에서 추가된 화면들 — 이게 빠져 있어서 챌린지
  // 관련 페이지뷰가 전부 `/`로 집계되고 있었다.
  "t",
  "create",
  "challenges",
  "me",
  "login",
  "invite",
  "connect",
] as const;

export function toSafePath(pathname: string): string {
  const section = pathname.split("/")[1] ?? "";
  return (SAFE_PATH_SECTIONS as readonly string[]).includes(section) ? `/${section}` : "/";
}
