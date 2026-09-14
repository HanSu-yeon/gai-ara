"use client";

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { trackEvent } from "@/lib/analytics";

/**
 * GA4 커스텀 이벤트를 붙인 링크. 서버 컴포넌트(홈, 공개 챌린지 목록,
 * `BrandHeader`) 안에서도 클릭을 집계할 수 있게 하려고 만든 얇은 래퍼다 —
 * 이것 하나면 각 화면을 클라이언트 컴포넌트로 바꾸지 않아도 된다.
 *
 * 페이지뷰는 `layout.tsx`의 gtag 기본 설정이 이미 잡는다. 여기서 보내는 건
 * "어디서 눌러서 그 화면에 갔는가"다 — `/t/{token}` 페이지뷰만으로는 공개
 * 목록에서 들어온 건지 공유 링크로 들어온 건지 구분할 수 없고, 그 구분이
 * "공개 목록이 실제로 효과가 있나"의 핵심 지표다.
 *
 * 파라미터에는 식별 정보를 절대 넣지 않는다(`analytics.ts` 주석 참고) —
 * 챌린지 토큰도 보내지 않는다. 어느 화면에서 눌렀는지(`source`)까지만
 * 보낸다.
 */
export function TrackedLink({
  event,
  params,
  children,
  ...linkProps
}: ComponentProps<typeof Link> & {
  event: string;
  params?: Record<string, string | number | boolean>;
  children: ReactNode;
}) {
  return (
    <Link {...linkProps} onClick={() => trackEvent(event, params)}>
      {children}
    </Link>
  );
}
