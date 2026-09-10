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

export const metadata: Metadata = {
  title: "가이 알아? — 제주에서 몇 다리?",
  description: "제주에서 우리는 몇 다리 건너 연결되어 있을까?",
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
