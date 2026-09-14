import type { Metadata } from "next";
import TargetChallengeScreen from "@/components/TargetChallengeScreen";

const SHARE_IMAGE = { url: "/assets/gamgyul-wave.png", width: 1234, height: 1274, alt: "인사하는 감귤 캐릭터" };

const title = "우리 진짜 닿을 수 있을까? · 가이 알아?";
const description = "여러 사람이 각자 아는 사람을 보태서, 궁금한 사람까지 이어지는 길을 함께 찾아가요.";

export const metadata: Metadata = {
  title,
  description,
  openGraph: { title, description, images: [SHARE_IMAGE], locale: "ko_KR", type: "website" },
  twitter: { card: "summary_large_image", title, description, images: [SHARE_IMAGE.url] },
};

export default function TargetChallengePage() {
  return <TargetChallengeScreen />;
}
