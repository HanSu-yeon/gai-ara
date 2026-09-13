import type { MetadataRoute } from "next";

const SITE_URL = "https://gai-ara-rouge.vercel.app";

/**
 * /r, /result는 초대 토큰·로그인 세션을 다루는 개인용 링크라 검색엔진에
 * 노출되면 안 된다 — 색인되면 그 URL 자체가 검색 결과/캐시에 남아 사실상
 * 토큰이 유출되는 셈이다. /connect, /invite도 로그인 사용자 전용·1회성
 * 토큰 링크라 함께 막는다.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/r/", "/result", "/connect", "/invite/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
