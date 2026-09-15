import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import { VercelAnalytics } from "@/components/VercelAnalytics";
import { SAFE_PATH_SECTIONS } from "@/lib/safe-path";
import "./globals.css";

const jalnan = localFont({
  src: "./fonts/Jalnan2.otf",
  variable: "--font-rounded",
  weight: "400",
  display: "swap",
  adjustFontFallback: false,
});

const SITE_URL = "https://gai-ara-rouge.vercel.app";
const SHARE_TITLE = "가이 알아? 우리, 생각보다 가까울지도 🍊";
const SHARE_DESCRIPTION = "나랑 얼마나 가까운 사이인지 확인해봐요.";
const GA_MEASUREMENT_ID = "G-VDR05ET2TB";

export const metadata: Metadata = {
  // TODO: 커스텀 도메인을 연결하면 이 값을 그 도메인으로 바꾼다.
  metadataBase: new URL(SITE_URL),
  title: SHARE_TITLE,
  description: SHARE_DESCRIPTION,
  keywords: ["가이 알아", "인스타 맞팔", "제주", "몇 다리", "소셜 그래프", "인스타그램 친구"],
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  verification: {
    google: "RDgVhiSLnEHwV8-kpjK_xkY_H-LI71VJ09tgiQTbHkE",
    other: { "naver-site-verification": "50274556ac95993525fb0e36fa8b9088879b8535" },
  },
  openGraph: {
    title: SHARE_TITLE,
    description: SHARE_DESCRIPTION,
    url: SITE_URL,
    siteName: "가이 알아?",
    locale: "ko_KR",
    type: "website",
    images: [
      {
        url: "/assets/gamgyul-wave.png",
        width: 1234,
        height: 1274,
        alt: "인사하는 감귤 캐릭터",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SHARE_TITLE,
    description: SHARE_DESCRIPTION,
    images: ["/assets/gamgyul-wave.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html data-scroll-behavior="smooth" lang="ko" className={jalnan.variable}>
      <body className="min-h-screen">
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){window.dataLayer.push(arguments);}
            gtag('js', new Date());
            // Only send known page categories, never tokens or query strings.
            // The list lives in lib/safe-path.ts so GA and Vercel Analytics
            // cannot drift apart on what is safe to send.
            var section = window.location.pathname.split('/')[1];
            var pages = ${JSON.stringify(SAFE_PATH_SECTIONS)};
            var safePath = pages.includes(section) ? '/' + section : '/';
            gtag('config', '${GA_MEASUREMENT_ID}', {
              page_location: '${SITE_URL}' + safePath,
              page_referrer: '',
              allow_google_signals: false,
              allow_ad_personalization_signals: false
            });
          `}
        </Script>
        <div className="brand-shell">{children}</div>
        <VercelAnalytics />
      </body>
    </html>
  );
}
