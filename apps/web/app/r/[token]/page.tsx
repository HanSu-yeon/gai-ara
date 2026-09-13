import type { Metadata } from "next";
import { ReferralLanding } from "@/components/ReferralLanding";

const SHARE_IMAGE = { url: "/assets/gamgyul-wave.png", width: 1234, height: 1274, alt: "인사하는 감귤 캐릭터" };

const title = "생각보다 가까웠어요 · 가이 알아?";
const description = "서로 모르는 사이여도 건너건너 연결돼 있을 수 있어요. 지금 확인해봐요.";

export const metadata: Metadata = {
  title,
  description,
  openGraph: { title, description, images: [SHARE_IMAGE], locale: "ko_KR", type: "website" },
  twitter: { card: "summary_large_image", title, description, images: [SHARE_IMAGE.url] },
};

export default function ReferralPage() { return <ReferralLanding />; }
