import type { MetadataRoute } from "next";

const SITE_URL = "https://gai-ara-rouge.vercel.app";

/**
 * /r, /pair, /result는 초대 토큰·복구 토큰을 담은 개인용 링크라 검색엔진에
 * 노출되면 안 된다 — 색인되면 그 URL 자체가 검색 결과/캐시에 남아 사실상
 * 토큰이 유출되는 셈이다. /connections, /preview도 세션 전용·내부 확인용이라
 * 함께 막는다.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/r/", "/pair/", "/result", "/connections", "/preview"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
