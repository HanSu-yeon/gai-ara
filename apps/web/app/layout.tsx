import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
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

export const metadata: Metadata = {
  // TODO: 커스텀 도메인을 연결하면 이 값을 그 도메인으로 바꾼다.
  metadataBase: new URL(SITE_URL),
  title: SHARE_TITLE,
  description: SHARE_DESCRIPTION,
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
        <div className="brand-shell">{children}</div>
      </body>
    </html>
  );
}
