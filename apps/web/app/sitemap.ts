import type { MetadataRoute } from "next";

const SITE_URL = "https://gai-ara-rouge.vercel.app";

/** 검색엔진이 색인해도 되는 공개 페이지만 담는다 — 초대/결과 링크는 robots.ts에서 막았으니 여기도 넣지 않는다. */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: SITE_URL, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/upload`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/upload/guide`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/privacy`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
  ];
}
