import type { Metadata } from "next";
import { ReferralLanding } from "@/components/ReferralLanding";
import { getReferralLinkNickname } from "@/lib/referral-links";
import { isBackendConfigured } from "@/lib/env";

const SHARE_IMAGE = { url: "/assets/gamgyul-wave.png", width: 1234, height: 1274, alt: "인사하는 감귤 캐릭터" };

export async function generateMetadata(
  { params }: { params: Promise<{ token: string }> },
): Promise<Metadata> {
  const { token } = await params;
  const link = isBackendConfigured() ? await getReferralLinkNickname(token) : null;

  const title = link?.nickname ? `${link.nickname}님이 초대했어요 · 가이 알아?` : "친구가 초대했어요 · 가이 알아?";
  const description = "우리, 몇 다리 건너 아는 사이일까? 지금 확인해봐요.";

  return {
    title,
    description,
    openGraph: { title, description, images: [SHARE_IMAGE], locale: "ko_KR", type: "website" },
    twitter: { card: "summary_large_image", title, description, images: [SHARE_IMAGE.url] },
  };
}

export default function ReferralPage() { return <ReferralLanding />; }
