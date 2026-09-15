"use client";

import { Analytics } from "@vercel/analytics/next";
import { toSafePath } from "@/lib/safe-path";

/**
 * Vercel Web Analytics. 기본 동작은 방문한 **전체 경로**를 그대로 보내는데,
 * 이 서비스의 경로에는 토큰이 들어 있다(`/t/{token}`, `/r/{token}`,
 * `/invite/{token}`). 토큰은 그 자체로 특정 챌린지·특정 사람의 링크라서
 * 외부 분석 서비스에 남기지 않는다 — `layout.tsx`의 GA 설정이 같은 이유로
 * 이미 경로를 첫 구간까지만 줄여서 보내고 있고, 여기서도 똑같이 맞춘다
 * (`toSafePath`가 두 곳의 정본이다).
 *
 * `beforeSend`는 함수라 서버 컴포넌트에서 prop으로 넘길 수 없다(직렬화
 * 불가). 그래서 이 얇은 클라이언트 래퍼를 두고 `layout.tsx`는 이것만
 * 렌더링한다.
 */
export function VercelAnalytics() {
  return (
    <Analytics
      beforeSend={(event) => {
        try {
          const url = new URL(event.url);
          url.pathname = toSafePath(url.pathname);
          url.search = "";
          url.hash = "";
          return { ...event, url: url.toString() };
        } catch {
          // 경로를 안전하게 만들 수 없으면 아예 보내지 않는다.
          return null;
        }
      }}
    />
  );
}
