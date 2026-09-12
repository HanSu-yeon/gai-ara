import type { Metadata } from "next";
import { ReferralLanding } from "@/components/ReferralLanding";

const SHARE_IMAGE = { url: "/assets/gamgyul-wave.png", width: 1234, height: 1274, alt: "인사하는 감귤 캐릭터" };

const title = "몇 명의 지인을 거치면 닿을까요? · 가이 알아?";
const description = "우리, 몇 다리 건너 아는 사이일까? 지금 확인해봐요.";

export const metadata: Metadata = {
  title,
  description,
  openGraph: { title, description, images: [SHARE_IMAGE], locale: "ko_KR", type: "website" },
  twitter: { card: "summary_large_image", title, description, images: [SHARE_IMAGE.url] },
};

export default function ReferralPage() { return <ReferralLanding />; }
